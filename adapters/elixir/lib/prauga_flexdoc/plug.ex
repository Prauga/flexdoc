defmodule PraugaFlexDoc.Plug do
  @moduledoc "A self-contained Plug serving FlexDoc and its version-matched renderer assets."
  @behaviour Plug
  import Plug.Conn

  alias PraugaFlexDoc.Config

  @assets Path.expand("../../assets", __DIR__)
  @javascript File.read!(Path.join(@assets, "flexdoc.standalone.js"))
  @css File.read!(Path.join(@assets, "flexdoc.standalone.css"))
  @fingerprint :crypto.hash(:sha256, @javascript <> <<0>> <> @css) |> binary_part(0, 8) |> Base.encode16(case: :lower)

  @impl Plug
  def init(opts), do: Config.new(opts)

  @impl Plug
  def call(conn, %Config{} = config) do
    case conn.request_path do
      path when path == config.path or path == config.path <> "/" -> docs(conn, config)
      path when path == config.path <> "/__flexdoc/renderer.js" -> asset(conn, @javascript, "application/javascript; charset=utf-8")
      path when path == config.path <> "/__flexdoc/renderer.css" -> asset(conn, @css, "text/css; charset=utf-8")
      _ -> send_resp(conn, 404, "Not Found")
    end
  end

  defp docs(conn, config) do
    options = %{
      contractVersion: "1",
      title: config.title,
      theme: config.theme,
      tryIt: %{enabled: config.try_it_enabled}
    }

    html = """
    <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>#{escape_html(config.title)}</title><link rel="stylesheet" href="#{config.path}/__flexdoc/renderer.css?v=#{@fingerprint}"></head><body><div id="flexdoc-root"></div><script>window.__FLEXDOC_SPEC_URL__=#{safe_json(config.spec_url)};window.__FLEXDOC_OPTIONS__=#{safe_json(options)};</script><script src="#{config.path}/__flexdoc/renderer.js?v=#{@fingerprint}"></script><script>(async function(){const root=document.getElementById('flexdoc-root');try{const baseUri=new URL(window.__FLEXDOC_SPEC_URL__,window.location.href).toString();const response=await fetch(baseUri);if(!response.ok)throw new Error('Unable to load OpenAPI specification: HTTP '+response.status);const spec=await response.json();const config={spec:spec,options:window.__FLEXDOC_OPTIONS__||{},baseUri:baseUri};if(window.FlexDocStandalone.mountAsync)await window.FlexDocStandalone.mountAsync(root,config);else window.FlexDocStandalone.mount(root,config);}catch(error){root.textContent=error instanceof Error?error.message:String(error);}})();</script></body></html>
    """

    conn
    |> put_resp_content_type("text/html", "utf-8")
    |> put_resp_header("cache-control", "no-cache")
    |> send_resp(200, html)
  end

  defp asset(conn, body, content_type) do
    conn
    |> put_resp_header("content-type", content_type)
    |> put_resp_header("cache-control", "public, max-age=31536000, immutable")
    |> send_resp(200, body)
  end

  defp safe_json(value) do
    value
    |> Jason.encode!()
    |> String.replace("<", "\\u003c")
    |> String.replace(">", "\\u003e")
    |> String.replace("&", "\\u0026")
    |> String.replace(<<0xE2, 0x80, 0xA8>>, "\\u2028")
    |> String.replace(<<0xE2, 0x80, 0xA9>>, "\\u2029")
  end

  defp escape_html(value) do
    value
    |> to_string()
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&#39;")
  end
end
