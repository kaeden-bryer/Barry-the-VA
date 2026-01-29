import json
import urllib.request

url = "http://127.0.0.1:8000/ask"
payload = {"text": "Hello, who are you?"}

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        print('Status:', resp.status)
        # Print Assistant header if present
        h = resp.getheader('X-Assistant-Text')
        if h:
            try:
                import urllib.parse
                print('Assistant header (decoded):', urllib.parse.unquote(h))
            except Exception:
                print('Assistant header (raw):', h)
        content = resp.read()
        print('Content-Type:', resp.getheader('Content-Type'))
        # Print first 2000 chars to avoid huge binary
        print('Body:', content[:2000])
except urllib.error.HTTPError as he:
    # Print status and response body from server errors
    print('HTTPError:', he.code, he.reason)
    try:
        body = he.read()
        print('Error body (first 2000 bytes):')
        print(body[:2000])
    except Exception:
        pass
except Exception as e:
    import traceback
    traceback.print_exc()
