package com.prauga.example.quarkus;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class DocsResourceTest {
  @Test
  void servesDocsAndPackagedRenderer() {
    given().when().get("/docs").then().statusCode(200).body(containsString("Quarkus FlexDoc Example"));
    given().when().get("/docs/__flexdoc/renderer.js").then().statusCode(200);
    given().when().get("/docs/__flexdoc/renderer.css").then().statusCode(200);
  }
}
