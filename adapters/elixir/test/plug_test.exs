defmodule PraugaFlexDoc.PlugTest do
  use ExUnit.Case, async: true
  use Plug.Test

  alias PraugaFlexDoc.Plug, as: FlexDocPlug

  @opts FlexDocPlug.init(path: "/reference", spec_url: "/openapi.json", title: "Plug <API>")

  defp renderer_options(body) do
    [_, json] = Regex.run(~r/window\.__FLEXDOC_OPTIONS__=(.*?);<\/script>/, body)
    Jason.decode!(json)
  end

  test "serves docs and packaged renderer assets" do
    docs = conn(:get, "/reference") |> FlexDocPlug.call(@opts)
    assert docs.status == 200
    assert get_resp_header(docs, "cache-control") == ["no-cache"]
    assert docs.resp_body =~ "Plug &lt;API&gt;"
    assert docs.resp_body =~ ~s(window.__FLEXDOC_SPEC_URL__="/openapi.json")

    options = renderer_options(docs.resp_body)
    assert options["tryIt"]["enabled"] == true
    refute Map.has_key?(options, "expand")

    js = conn(:get, "/reference/__flexdoc/renderer.js") |> FlexDocPlug.call(@opts)
    assert js.status == 200
    assert get_resp_header(js, "cache-control") == ["public, max-age=31536000, immutable"]
    assert byte_size(js.resp_body) > 1000
  end

  test "injects expansion and nested Try It settings" do
    opts =
      FlexDocPlug.init(
        expand: "documentation",
        try_it_default_server: "https://api.example.test",
        try_it_credentials: "include",
        try_it_api_client_persistence_key: false
      )

    docs = conn(:get, "/docs") |> FlexDocPlug.call(opts)
    options = renderer_options(docs.resp_body)

    assert options["expand"] == "documentation"
    assert options["tryIt"]["enabled"] == true
    assert options["tryIt"]["defaultServer"] == "https://api.example.test"
    assert options["tryIt"]["credentials"] == "include"
    assert options["tryIt"]["apiClientPersistenceKey"] == false

    list_opts = FlexDocPlug.init(expand: ["parameters", "tryIt"])
    list_docs = conn(:get, "/docs") |> FlexDocPlug.call(list_opts)
    assert renderer_options(list_docs.resp_body)["expand"] == ["parameters", "tryIt"]
  end

  test "keeps title and spec JSON script safe" do
    opts =
      FlexDocPlug.init(
        spec_url: "</script><script>alert('spec')</script>",
        title: "</script><script>alert('title')</script>"
      )

    docs = conn(:get, "/docs") |> FlexDocPlug.call(opts)
    refute docs.resp_body =~ "</script><script>alert('spec')</script>"
    refute docs.resp_body =~ "</script><script>alert('title')</script>"
    assert docs.resp_body =~ "\\u003c/script\\u003e"
  end

  test "returns 404 outside the configured mount" do
    conn = conn(:get, "/elsewhere") |> FlexDocPlug.call(@opts)
    assert conn.status == 404
  end
end
