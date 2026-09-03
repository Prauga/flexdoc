# frozen_string_literal: true

module Prauga
  module FlexDoc
    class RackApp
      def initialize(host = Host.new)
        @host = host
      end

      def call(env)
        path = "#{env.fetch("SCRIPT_NAME", "")}#{env.fetch("PATH_INFO", "")}"
        @host.response_for_path(path).rack
      end
    end
  end
end
