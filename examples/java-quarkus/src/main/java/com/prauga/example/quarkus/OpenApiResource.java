package com.prauga.example.quarkus;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/openapi.json")
public class OpenApiResource {
  @GET
  @Produces(MediaType.APPLICATION_JSON)
  public String openApi() {
    return "{\"openapi\":\"3.1.0\",\"info\":{\"title\":\"Quarkus Example\",\"version\":\"1.0.0\"},\"paths\":{}}";
  }
}
