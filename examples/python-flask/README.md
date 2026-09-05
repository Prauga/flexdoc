# Flask + FlexDoc

This example uses the WSGI-capable `prauga-flexdoc` `0.4.0` package and the `setup_flask_flexdoc` helper. Flask remains an optional dependency of FlexDoc.

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:8001/docs`.

`prauga-flexdoc` is pinned to `0.4.0`. CI installs the wheel built from the same commit before exercising this example.
