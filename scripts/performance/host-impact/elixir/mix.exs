defmodule FlexDocHostImpact.MixProject do
  use Mix.Project

  def project do
    [
      app: :flexdoc_host_impact,
      version: "0.1.0",
      elixir: "~> 1.17",
      deps: deps()
    ]
  end

  def application, do: [extra_applications: [:logger]]

  defp deps do
    [
      {:prauga_flexdoc, path: "../../../../adapters/elixir", override: true},
      {:plug_cowboy, "~> 2.7"}
    ]
  end
end
