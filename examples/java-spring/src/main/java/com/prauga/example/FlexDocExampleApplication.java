package com.prauga.example;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class FlexDocExampleApplication {

    public static void main(String[] args) {
        SpringApplication.run(FlexDocExampleApplication.class, args);
    }

    @Operation(summary = "Say hello", description = "Returns a greeting for the supplied name")
    @ApiResponse(responseCode = "200", description = "Greeting returned")
    @GetMapping("/hello/{name}")
    public Greeting hello(
            @Parameter(description = "Name to greet", required = true)
            @PathVariable String name) {
        return new Greeting("Hello, " + name + "!");
    }

    public record Greeting(
            @Schema(description = "Greeting text", example = "Hello, FlexDoc!")
            String message) {
    }
}
