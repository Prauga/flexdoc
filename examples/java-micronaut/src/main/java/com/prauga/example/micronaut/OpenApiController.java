package com.prauga.example.micronaut;

import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;

@Controller("/openapi.json")
public class OpenApiController {
  @Get(produces = MediaType.APPLICATION_JSON)
  public String openApi() {
    return "{\"openapi\":\"3.1.0\",\"info\":{\"title\":\"Micronaut Example\",\"version\":\"1.0.0\"},\"paths\":{}}";
  }
}
