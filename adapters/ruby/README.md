# Prauga FlexDoc for Ruby

`prauga-flexdoc` `0.1.0` provides one framework-neutral Ruby 3.2+ host for the canonical FlexDoc renderer, plus thin Rack and Rails integrations.

## Rack

```ruby
require "prauga/flexdoc"

host = Prauga::FlexDoc::Host.new(
  Prauga::FlexDoc::Config.new(
    path: "/docs",
    spec_url: "/openapi.json",
    title: "My API"
  )
)

run Prauga::FlexDoc::RackApp.new(host)
```

The Rack app reconstructs `SCRIPT_NAME + PATH_INFO`, so it also works correctly when mounted beneath another Rack application.

## Rails

In `config/routes.rb`:

```ruby
host = Prauga::FlexDoc::Host.new(
  Prauga::FlexDoc::Config.new(
    path: "/docs",
    spec_url: "/openapi.json",
    title: "My API"
  )
)
Prauga::FlexDoc::Rails.mount(self, host: host, at: "/docs")
```

Rails already uses Rack, so the Rails helper intentionally mounts the same `RackApp` rather than introducing a Rails-specific renderer host. If `at:` is supplied, it must resolve to the same normalized path as `host.config.path`; the helper raises immediately on a mismatch so the HTML shell cannot point at renderer asset URLs that the mounted Rack app will reject.

## Packaging

The gem packages the exact canonical `flexdoc.standalone.js` and `.css`. CI tests the neutral host, Rack mounting, Rails routing, gem contents, and byte-for-byte renderer parity.
