# frozen_string_literal: true

module Prauga
  module FlexDoc
    # Rack application that serves FlexDoc routes from a {Host}.
    class RackApp
      # @param host [Host] host backing the Rack application
      def initialize(host = Host.new)
        @host = host
      end

      # Rack entrypoint.
      #
      # @param env [Hash] Rack environment
      # @return [Array]
      def call(env)
        path = "#{env.fetch("SCRIPT_NAME", "")}#{env.fetch("PATH_INFO", "")}"
        @host.response_for_path(path).rack
      end
    end
  end
end
