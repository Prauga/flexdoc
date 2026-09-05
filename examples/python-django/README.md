# Django + FlexDoc

This example uses `prauga-flexdoc` `0.4.0` and `django_urlpatterns()` to expose `/docs`, `/docs/__flexdoc/renderer.js`, and `/docs/__flexdoc/renderer.css` through Django's native URL routing. The same package also exposes `FlexDocWSGI` for direct middleware-style WSGI hosting and `FlexDocASGI` for Django ASGI deployments.

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
DJANGO_SETTINGS_MODULE=flexdoc_django.settings python -m django runserver 8002
```

Open `http://127.0.0.1:8002/docs`.

`prauga-flexdoc` is pinned to `0.4.0`. CI installs the wheel built from the same commit before exercising this example.
