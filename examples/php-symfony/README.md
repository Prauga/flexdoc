# Symfony + FlexDoc

Install `prauga/flexdoc` `0.3.0`, register a `FlexDocHost` service, and inject it into `Prauga\FlexDoc\Symfony\FlexDocController`. Map three routes for the documentation shell and renderer assets.

```yaml
flexdoc_docs:
  path: /docs
  controller: Prauga\\FlexDoc\\Symfony\\FlexDocController::documentation
flexdoc_js:
  path: /docs/__flexdoc/renderer.js
  controller: Prauga\\FlexDoc\\Symfony\\FlexDocController::rendererJavaScript
flexdoc_css:
  path: /docs/__flexdoc/renderer.css
  controller: Prauga\\FlexDoc\\Symfony\\FlexDocController::rendererCss
```

The controller is only a Symfony response translator; renderer behavior stays in `FlexDocHost`.
