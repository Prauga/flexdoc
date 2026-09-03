# frozen_string_literal: true

module Prauga
  module FlexDoc
    Response = Data.define(:status, :content_type, :body, :cache_control) do
      def headers
        result = {
          "content-type" => content_type,
          "content-length" => body.bytesize.to_s
        }
        result["cache-control"] = cache_control if cache_control
        result
      end

      def rack
        [status, headers, [body]]
      end
    end
  end
end
