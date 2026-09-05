# Prauga FlexDoc for Plug and Phoenix

`prauga_flexdoc` `0.3.0` is a self-contained Plug that packages the canonical FlexDoc renderer.

## Plug

```elixir
plug PraugaFlexDoc.Plug,
  path: "/docs",
  spec_url: "/openapi.json",
  title: "My API"
```

The Plug config also accepts `expand`, `try_it_default_server`, `try_it_credentials`, and `try_it_api_client_persistence_key`; expansion may be a preset string or section list, and persistence may be a string or `false`.

## Phoenix

Phoenix routers can forward directly to the same Plug:

```elixir
forward "/docs", PraugaFlexDoc.Plug,
  path: "/docs",
  spec_url: "/openapi.json",
  title: "My API"
```

Because Phoenix is Plug-based, no Phoenix-specific renderer implementation is necessary. CI exercises the package through `Plug.Test` and byte-compares its packaged JS/CSS with the canonical renderer.
