# Rails + FlexDoc

Add `prauga-flexdoc` `0.2.0`, then mount the packaged Rack integration from `config/routes.rb`:

```ruby
host = Prauga::FlexDoc::Host.new(
  Prauga::FlexDoc::Config.new(spec_url: "/openapi.json", title: "Rails API")
)
Prauga::FlexDoc::Rails.mount(self, host: host, at: "/docs")
```

The Rails integration is deliberately thin: Rails routing mounts the same Rack application tested independently by the gem.
