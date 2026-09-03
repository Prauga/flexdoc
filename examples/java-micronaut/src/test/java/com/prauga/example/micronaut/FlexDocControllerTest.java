package com.prauga.example.micronaut;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.client.HttpClient;
import io.micronaut.http.client.annotation.Client;
import io.micronaut.test.extensions.junit5.annotation.MicronautTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

@MicronautTest
class FlexDocControllerTest {
  @Inject
  @Client("/")
  HttpClient client;

  @Test
  void servesDocsAndPackagedRenderer() {
    var docs = client.toBlocking().exchange(HttpRequest.GET("/docs"), String.class);
    assertEquals(HttpStatus.OK, docs.getStatus());
    assertTrue(docs.body().contains("Micronaut FlexDoc Example"));
    assertEquals(HttpStatus.OK, client.toBlocking().exchange(HttpRequest.GET("/docs/__flexdoc/renderer.js")).getStatus());
    assertEquals(HttpStatus.OK, client.toBlocking().exchange(HttpRequest.GET("/docs/__flexdoc/renderer.css")).getStatus());
  }
}
