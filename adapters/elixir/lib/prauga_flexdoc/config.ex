defmodule PraugaFlexDoc.Config do
  @moduledoc """
  FlexDoc renderer configuration.

  Build with `new/1`. All options are keyword arguments with sensible defaults.

  ## Options

    * `:path` - docs mount path (default `"/docs"`)
    * `:spec_url` - OpenAPI document URL (default `"/openapi.json"`)
    * `:title` - page and renderer title (default `"API Reference"`)
    * `:theme` - renderer theme preset: `"system"`, `"light"`, or `"dark"`
    * `:try_it_enabled` - whether the Try It client is enabled (default `true`)
    * `:expand` - optional expansion preset or section list
    * `:try_it_default_server` - optional default server URL for Try It requests
    * `:try_it_credentials` - optional fetch credentials mode: `"omit"`, `"same-origin"`, or `"include"`
    * `:try_it_api_client_persistence_key` - optional persistence key, or `false` to disable
    * `:try_it_host_execution` - emits host-execution protocol metadata; execution is not implemented by this adapter
  """

  @typedoc "Validated FlexDoc configuration."
  @type t :: %__MODULE__{
          path: String.t(),
          spec_url: String.t(),
          title: String.t(),
          theme: String.t(),
          try_it_enabled: boolean(),
          expand: term(),
          try_it_default_server: String.t() | nil,
          try_it_credentials: String.t() | nil,
          try_it_api_client_persistence_key: String.t() | false | nil,
          try_it_host_execution: boolean()
        }

  defstruct path: "/docs",
            spec_url: "/openapi.json",
            title: "API Reference",
            theme: "system",
            try_it_enabled: true,
            expand: nil,
            try_it_default_server: nil,
            try_it_credentials: nil,
            try_it_api_client_persistence_key: nil,
            try_it_host_execution: false

  @doc """
  Creates a validated configuration from keyword options.

  See the module documentation for supported options.
  """
  @spec new(keyword()) :: t()
  def new(opts \\ []) do
    config = struct!(__MODULE__, Map.new(opts))
    path = "/" <> (config.path |> to_string() |> String.trim() |> String.trim("/"))
    path = if path == "/", do: "/docs", else: path
    theme = to_string(config.theme)
    unless theme in ["system", "light", "dark"], do: raise(ArgumentError, "FlexDoc theme must be system, light, or dark")

    if config.try_it_credentials not in [nil, "omit", "same-origin", "include"] do
      raise ArgumentError, "FlexDoc Try It credentials must be omit, same-origin, or include"
    end

    persistence_key = config.try_it_api_client_persistence_key
    unless is_nil(persistence_key) or persistence_key == false or is_binary(persistence_key) do
      raise ArgumentError, "FlexDoc API Client persistence key must be a string, false, or nil"
    end

    %{config | path: path, theme: theme}
  end
end
