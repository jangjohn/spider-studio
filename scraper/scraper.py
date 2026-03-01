#!/usr/bin/env python3
"""
Spider Studio - Playwright-based web scraper.
Usage: python scraper.py --config '<json config>'
Output: JSON lines with progress, final line: DATA:[...] or ERROR:message
"""
import argparse
import json
import sys
import time
from typing import Any

def log(msg: str) -> None:
    """Print to stderr so it appears in terminal; prefixed for Tauri to capture."""
    print(f"[SCRAPER] {msg}", file=sys.stderr, flush=True)

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERROR: Playwright not installed. Run: pip install playwright && playwright install", file=sys.stderr)
    sys.exit(1)


def clean_value(value: str, rule: str) -> str | int | float:
    """Apply cleaning rule to extracted value."""
    if not value or not isinstance(value, str):
        return value
    value = value.strip()
    if rule == "Trim":
        return value.strip()
    if rule == "Remove currency":
        import re
        return re.sub(r'[^\d.,\-]', '', value).strip()
    if rule == "Extract numbers":
        import re
        match = re.search(r'[\d.,\-]+', value)
        return float(match.group().replace(',', '')) if match else value
    return value


def _extract_field_from_elements(elements: list, field: dict, data_type: str, cleaning: str) -> Any:
    """Extract value(s) from elements. Returns single value or comma-joined string for multi-value."""
    values: list[Any] = []
    for el in elements:
        try:
            if data_type == "Image":
                src = el.get_attribute("src") or ""
                values.append(src if src else None)
            elif data_type == "Link":
                href = el.get_attribute("href") or ""
                values.append(href if href else None)
            else:
                text = el.inner_text().strip()
                values.append(clean_value(text, cleaning))
        except Exception as ex:
            log(f"  Warning extracting from element: {ex}")
            values.append(None)
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    joined = ", ".join(str(v) for v in values if v is not None)
    return joined if joined else None


def _extract_with_container(page, fields: list, container_sel: str) -> list[dict[str, Any]]:
    """Extract rows by finding containers first, then each field within each container.
    Multi-value fields within a container are joined with comma."""
    try:
        containers = page.query_selector_all(container_sel)
    except Exception as e:
        log(f"  ERROR querying container selector {container_sel!r}: {e}")
        return []
    results: list[dict[str, Any]] = []
    for cidx, container in enumerate(containers):
        row: dict[str, Any] = {}
        for i, field in enumerate(fields):
            sel = (field.get("selector") or "").strip()
            name = field.get("name") or f"field_{i}"
            if not sel:
                row[name] = None
                continue
            data_type = field.get("data_type") or field.get("dataType", "Text")
            cleaning = field.get("cleaning_rule") or field.get("cleaningRule", "None")
            try:
                elements = container.query_selector_all(sel)
            except Exception as e:
                log(f"  Warning in container {cidx} selector {sel!r}: {e}")
                elements = []
            row[name] = _extract_field_from_elements(elements, field, data_type, cleaning)
        if any(v is not None for v in row.values()):
            results.append(row)
    return results


def _extract_from_page(page, fields: list, row_container_selector: str | None = None) -> list[dict[str, Any]]:
    """Extract field values from a loaded page. Returns list of row dicts.
    If row_container_selector is set, extract each field relative to each container (multi-values joined with comma).
    Otherwise use legacy independent extraction."""
    if row_container_selector and row_container_selector.strip():
        return _extract_with_container(page, fields, row_container_selector.strip())

    all_field_values: list[list[Any]] = []
    names = []

    for i, field in enumerate(fields):
        sel = (field.get("selector") or "").strip()
        name = field.get("name") or f"field_{i}"
        names.append(name)
        if not sel:
            log(f"  Field '{name}': empty selector, skipping")
            all_field_values.append([])
            continue
        data_type = field.get("data_type") or field.get("dataType", "Text")
        cleaning = field.get("cleaning_rule") or field.get("cleaningRule", "None")

        try:
            elements = page.query_selector_all(sel)
        except Exception as e:
            log(f"  ERROR querying selector {sel!r}: {e}")
            all_field_values.append([])
            continue

        values: list[Any] = []
        for el in elements:
            try:
                if data_type == "Image":
                    src = el.get_attribute("src") or ""
                    values.append(src if src else None)
                elif data_type == "Link":
                    href = el.get_attribute("href") or ""
                    values.append(href if href else None)
                else:
                    text = el.inner_text().strip()
                    values.append(clean_value(text, cleaning))
            except Exception as ex:
                log(f"  Warning extracting from element: {ex}")
                values.append(None)
        all_field_values.append(values)

    max_rows = max(len(v) for v in all_field_values) if all_field_values else 0
    results: list[dict[str, Any]] = []
    for row_idx in range(max_rows):
        row: dict[str, Any] = {}
        for col_idx, (name, values) in enumerate(zip(names, all_field_values)):
            row[name] = values[row_idx] if row_idx < len(values) else None
        if any(v is not None for v in row.values()):
            results.append(row)
    return results


def _find_next_page_auto(page) -> str | None:
    """Auto-detect next page link. Returns absolute URL or None."""
    from urllib.parse import urljoin
    base = page.url

    # 1. <a rel="next">
    try:
        el = page.query_selector('a[rel="next"]')
        if el:
            href = el.get_attribute("href")
            if href:
                return urljoin(base, href)
    except Exception:
        pass

    # 2. <a> with text "Next", "next", "›", "»", "下一页" (Playwright :has-text)
    next_texts = ["Next", "next", "›", "»", "下一页", "»»", ">", "››"]
    try:
        for text in next_texts:
            loc = page.locator(f'a:has-text("{text}")')
            if loc.count() > 0:
                href = loc.first.get_attribute("href")
                if href and "javascript:" not in href.lower():
                    return urljoin(base, href)
    except Exception:
        pass

    # 3. <a> with class containing "next"
    try:
        els = page.query_selector_all('a[class*="next"], a[class*="Next"]')
        for el in els:
            href = el.get_attribute("href")
            if href and "javascript:" not in href.lower():
                return urljoin(base, href)
    except Exception:
        pass

    # 4. <button> containing "Next" - check if inside <a>
    try:
        btn_loc = page.locator('button:has-text("Next"), button:has-text("next")')
        if btn_loc.count() > 0:
            parent = btn_loc.first.evaluate_handle("el => el.closest('a')")
            try:
                a = parent.as_element()
                if a:
                    href = a.get_attribute("href")
                    if href and "javascript:" not in href.lower():
                        return urljoin(base, href)
            except Exception:
                pass
    except Exception:
        pass

    return None


def _find_next_page_manual(page, next_selector: str) -> str | None:
    """Find next page URL using provided CSS selector."""
    from urllib.parse import urljoin
    if not (next_selector or next_selector.strip()):
        return None
    try:
        el = page.query_selector(next_selector.strip())
        if not el:
            return None
        # Try direct href on <a>
        href = el.get_attribute("href")
        if href and "javascript:" not in href.lower():
            return urljoin(page.url, href)
        # Try parent <a>
        parent = el.evaluate_handle("el => el.closest('a')")
        try:
            a = parent.as_element()
            if a:
                href = a.get_attribute("href")
                if href and "javascript:" not in href.lower():
                    return urljoin(page.url, href)
        except Exception:
            pass
    except Exception as e:
        log(f"  Error in manual next selector {next_selector!r}: {e}")
    return None


def _check_stop_requested() -> bool:
    """Check if stop/pause was requested via SPIDER_STOP_FILE env."""
    try:
        import os
        path = os.environ.get("SPIDER_STOP_FILE")
        return path is not None and os.path.exists(path)
    except Exception:
        return False


def scrape(config: dict) -> list[dict[str, Any]]:
    """Run scrape with optional pagination."""
    url = config.get("url", "")
    method = config.get("method", "GET")
    fields = config.get("fields", [])
    row_container = (config.get("rowContainerSelector") or config.get("row_container_selector") or "").strip() or None
    run_settings = config.get("run_settings") or config.get("runSettings", {})
    pagination = config.get("pagination") or {}

    log(f"Received URL: {url!r}")
    log(f"Method: {method}")
    log(f"Fields count: {len(fields)}")

    if not url:
        log("ERROR: No URL provided")
        return []
    if not fields:
        log("ERROR: No fields configured - add at least one field with a CSS selector")
        return []

    delay = run_settings.get("delay_between_requests") or run_settings.get("delayBetweenRequests", 1.0)
    mode_raw = pagination.get("mode", "None")
    mode = "none"
    if mode_raw in ("Auto-detect", "auto", "Auto"):
        mode = "auto"
    elif mode_raw in ("Manual", "manual"):
        mode = "manual"
    next_selector = pagination.get("nextButtonSelector") or pagination.get("next_button_selector")
    max_pages = int(pagination.get("maxPages") or pagination.get("max_pages") or 50)

    all_results: list[dict[str, Any]] = []
    page_num = 1
    current_url = url
    start_time = time.time()

    def emit_progress(rows: int, status: str = "running"):
        elapsed = time.time() - start_time
        speed = (rows / elapsed * 60) if elapsed > 0 else 0
        eta = int((max_pages - page_num) * (elapsed / page_num)) if page_num > 0 and rows > 0 else 0
        prog = {
            "page": page_num,
            "total_pages": max_pages,
            "rows": rows,
            "speed": round(speed, 1),
            "eta_seconds": eta,
            "status": status,
        }
        print(f"PROGRESS:{json.dumps(prog)}", flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            while current_url and page_num <= max_pages:
                if _check_stop_requested():
                    log("Stop/Pause requested, finishing with collected data")
                    break

                log(f"Page {page_num}/{max_pages}: {current_url}")
                page.goto(current_url, wait_until="domcontentloaded", timeout=30000)
                time.sleep(delay)

                page_results = _extract_from_page(page, fields, row_container)
                all_results.extend(page_results)
                emit_progress(len(all_results))

                if mode == "none":
                    break
                if mode == "auto":
                    current_url = _find_next_page_auto(page)
                elif mode == "manual" and next_selector:
                    current_url = _find_next_page_manual(page, next_selector)
                else:
                    current_url = None

                if not current_url:
                    break
                page_num += 1

        except Exception as e:
            log(f"ERROR during scrape: {e}")
            raise
        finally:
            browser.close()

    log(f"Scrape complete: {len(all_results)} rows")
    return all_results


# Viewport size used for screenshot and selector-at-point (must match)
PREVIEW_VIEWPORT = {"width": 1280, "height": 800}


def run_screenshot(url: str) -> dict:
    """Take screenshot of URL. Returns {base64, width, height}."""
    import base64
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport=PREVIEW_VIEWPORT)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(0.5)
            png_bytes = page.screenshot(type="png")
            b64 = base64.b64encode(png_bytes).decode("ascii")
            return {"base64": b64, "width": PREVIEW_VIEWPORT["width"], "height": PREVIEW_VIEWPORT["height"]}
        finally:
            browser.close()


def run_count_selector(url: str, selector: str) -> int:
    """Count elements matching selector on page. Returns 0 on error."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport=PREVIEW_VIEWPORT)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(0.3)
            elements = page.query_selector_all(selector)
            return len(elements)
        except Exception:
            return 0
        finally:
            browser.close()


def run_selector_at_point(url: str, x: int, y: int) -> str | None:
    """Get CSS selector for element at (x,y) on page. Returns selector or None."""
    sel_js = """
    (function(coords) {
        var x = coords[0], y = coords[1];
        var el = document.elementFromPoint(x, y);
        if (!el || el === document.body) return null;
        function escapeId(s) {
            try { return CSS.escape(s); } catch(_) { return s.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&'); }
        }
        function escapeClass(s) {
            try { return CSS.escape(s); } catch(_) { return s.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&'); }
        }
        if (el.id && /^[a-zA-Z][\\w-]*$/.test(el.id)) {
            var others = document.querySelectorAll('#' + escapeId(el.id));
            if (others.length === 1) return '#' + el.id;
        }
        if (el.className && typeof el.className === 'string') {
            var classes = el.className.trim().split(/\\s+/).filter(Boolean);
            if (classes.length > 0) {
                var sel = '.' + classes.slice(0, 2).map(escapeClass).join('.');
                try {
                    if (document.querySelectorAll(sel).length === 1) return sel;
                } catch(_) {}
            }
        }
        var path = [];
        var cur = el;
        while (cur && cur !== document.body) {
            var part = cur.tagName.toLowerCase();
            if (cur.id && /^[a-zA-Z][\\w-]*$/.test(cur.id)) {
                path.unshift('#' + cur.id);
                break;
            }
            if (cur.className && typeof cur.className === 'string') {
                var cs = cur.className.trim().split(/\\s+/).filter(Boolean);
                if (cs.length > 0 && cs.length <= 3)
                    part += '.' + cs.slice(0, 2).map(escapeClass).join('.');
            }
            var parent = cur.parentElement;
            if (parent) {
                var same = [].filter.call(parent.children, function(c) { return c.tagName === cur.tagName; });
                if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(cur) + 1) + ')';
            }
            path.unshift(part);
            cur = parent;
        }
        return path.join(' > ');
    })(arguments[0])
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport=PREVIEW_VIEWPORT)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(0.3)
            result = page.evaluate(sel_js, [x, y])
            return result
        finally:
            browser.close()


def compare_runs(file_a_path: str, file_b_path: str, key_field: str | None = None) -> dict[str, Any]:
    """
    Compare two CSV files. file_a = baseline (older), file_b = newer.
    Returns: { added, removed, changed, unchanged, headers }
    - added: rows in B only
    - removed: rows in A only
    - changed: [{ old, new, changed_fields }]
    - unchanged: rows in both with same values
    - headers: column names
    """
    import csv

    def load_csv(path: str) -> tuple[list[str], list[dict[str, str]]]:
        with open(path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            rows = [dict(row) for row in reader]
        return headers, rows

    headers_a, rows_a = load_csv(file_a_path)
    headers_b, rows_b = load_csv(file_b_path)
    all_headers = list(dict.fromkeys(headers_a + headers_b))

    def row_key(row: dict, key: str) -> str:
        return str(row.get(key, ""))

    def rows_equal(r1: dict, r2: dict, hdrs: list[str]) -> tuple[bool, list[str]]:
        changed = []
        for h in hdrs:
            v1 = str(r1.get(h, ""))
            v2 = str(r2.get(h, ""))
            if v1 != v2:
                changed.append(h)
        return len(changed) == 0, changed

    added: list[dict] = []
    removed: list[dict] = []
    changed: list[dict] = []
    unchanged: list[dict] = []

    if key_field and key_field in all_headers:
        map_a = {row_key(r, key_field): r for r in rows_a}
        map_b = {row_key(r, key_field): r for r in rows_b}
        keys_a = set(map_a.keys())
        keys_b = set(map_b.keys())
        for k in keys_b - keys_a:
            added.append(map_b[k])
        for k in keys_a - keys_b:
            removed.append(map_a[k])
        for k in keys_a & keys_b:
            ra, rb = map_a[k], map_b[k]
            eq, changed_fields = rows_equal(ra, rb, all_headers)
            if eq:
                unchanged.append(rb)
            else:
                changed.append({
                    "old": ra,
                    "new": rb,
                    "changed_fields": changed_fields,
                })
    else:
        n = max(len(rows_a), len(rows_b))
        for i in range(n):
            ra = rows_a[i] if i < len(rows_a) else {}
            rb = rows_b[i] if i < len(rows_b) else {}
            if i >= len(rows_a):
                added.append(rb)
            elif i >= len(rows_b):
                removed.append(ra)
            else:
                eq, changed_fields = rows_equal(ra, rb, all_headers)
                if eq:
                    unchanged.append(rb)
                else:
                    changed.append({
                        "old": ra,
                        "new": rb,
                        "changed_fields": changed_fields,
                    })

    return {
        "added": added,
        "removed": removed,
        "changed": changed,
        "unchanged": unchanged,
        "headers": all_headers,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", help="JSON config string")
    parser.add_argument("--config-file", help="Path to JSON config file")
    parser.add_argument("--screenshot", action="store_true", help="Take screenshot mode")
    parser.add_argument("--screenshot-url", help="URL for screenshot")
    parser.add_argument("--selector-at-point", action="store_true", help="Get selector at point")
    parser.add_argument("--selector-url", help="URL for selector lookup")
    parser.add_argument("--selector-x", type=int, help="X coordinate")
    parser.add_argument("--selector-y", type=int, help="Y coordinate")
    parser.add_argument("--count-selector", action="store_true", help="Count selector matches")
    parser.add_argument("--count-url", help="URL for count")
    parser.add_argument("--count-sel", help="Selector to count")
    parser.add_argument("--compare", action="store_true", help="Compare two CSV files")
    parser.add_argument("--compare-file-a", help="Baseline CSV path")
    parser.add_argument("--compare-file-b", help="Newer CSV path")
    parser.add_argument("--compare-key", help="Key field for row matching")
    args = parser.parse_args()

    if args.compare and args.compare_file_a and args.compare_file_b:
        try:
            result = compare_runs(args.compare_file_a, args.compare_file_b, args.compare_key or None)
            print(f"COMPARE:{json.dumps(result)}", flush=True)
            return
        except Exception as e:
            log(f"ERROR: {e}")
            print(f"ERROR:{e!s}", flush=True)
            sys.exit(1)

    if args.count_selector and args.count_url and args.count_sel:
        try:
            n = run_count_selector(args.count_url, args.count_sel)
            print(f"COUNT:{n}", flush=True)
            return
        except Exception as e:
            log(f"ERROR: {e}")
            print("COUNT:0", flush=True)
            sys.exit(1)

    if args.screenshot and args.screenshot_url:
        try:
            out = run_screenshot(args.screenshot_url)
            print(f"SCREENSHOT:{json.dumps(out)}", flush=True)
            return
        except Exception as e:
            log(f"ERROR: {e}")
            print(f"ERROR:{e!s}", flush=True)
            sys.exit(1)

    if args.selector_at_point and args.selector_url is not None and args.selector_x is not None and args.selector_y is not None:
        try:
            sel = run_selector_at_point(args.selector_url, args.selector_x, args.selector_y)
            print(f"SELECTOR:{json.dumps(sel)}", flush=True)
            return
        except Exception as e:
            log(f"ERROR: {e}")
            print(f"ERROR:{e!s}", flush=True)
            sys.exit(1)

    config_str = None
    if args.config_file:
        try:
            with open(args.config_file, "r", encoding="utf-8") as f:
                config_str = f.read()
            log(f"Read config from file: {args.config_file}")
        except Exception as e:
            log(f"ERROR reading config file: {e}")
            print(f"ERROR:Cannot read config file: {e}", flush=True)
            sys.exit(1)
    elif args.config:
        config_str = args.config
    else:
        log("ERROR: No --config or --config-file provided")
        print("ERROR:No config provided", flush=True)
        sys.exit(1)

    try:
        config = json.loads(config_str)
    except json.JSONDecodeError as e:
        log(f"ERROR parsing config JSON: {e}")
        print(f"ERROR:Invalid config JSON: {e}", flush=True)
        sys.exit(1)

    try:
        data = scrape(config)
        print(f"DATA:{json.dumps(data)}", flush=True)
    except Exception as e:
        log(f"ERROR: {e}")
        print(f"ERROR:{e!s}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
