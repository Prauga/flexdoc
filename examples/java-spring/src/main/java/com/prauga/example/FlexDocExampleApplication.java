package com.prauga.example;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@SpringBootApplication
@RestController
@OpenAPIDefinition(
        info = @Info(
                title = "FlexDoc Spring Showcase API",
                version = "2.2.0",
                description = "Code-first OpenAPI example for the FlexDoc 0.3 Spring Boot starter"),
        servers = {
                @Server(url = "http://localhost:8080", description = "Local development"),
                @Server(url = "https://canary.api.example.test", description = "Spot canary example")
        },
        tags = {
                @Tag(name = "Pets", description = "Parameters, JSON bodies and authentication"),
                @Tag(name = "Forms", description = "Multipart request bodies")
        })
@SecurityScheme(
        name = "bearerAuth",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT")
@SecurityScheme(
        name = "apiKeyAuth",
        type = SecuritySchemeType.APIKEY,
        in = SecuritySchemeIn.HEADER,
        paramName = "X-API-Key")
public class FlexDocExampleApplication {

    public static void main(String[] args) {
        SpringApplication.run(FlexDocExampleApplication.class, args);
    }

    @Operation(
            summary = "List pets",
            description = "Exercises query/header parameters and API-key metadata",
            tags = "Pets",
            security = @SecurityRequirement(name = "apiKeyAuth"))
    @ApiResponse(responseCode = "200", description = "Pets returned")
    @GetMapping("/pets")
    public List<Pet> listPets(
            @Parameter(description = "Maximum results")
            @RequestParam(defaultValue = "20") int limit,
            @Parameter(description = "Optional request trace identifier")
            @RequestHeader(value = "X-Trace-ID", required = false) String traceId) {
        return List.of(new Pet("pet-1", "Miso", "available", 3, List.of("friendly", "adoptable")));
    }

    @Operation(
            summary = "Create a pet",
            description = "Exercises a required JSON body and Bearer authentication",
            tags = "Pets",
            security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponse(responseCode = "201", description = "Pet created")
    @PostMapping("/pets")
    @ResponseStatus(HttpStatus.CREATED)
    public Pet createPet(@RequestBody PetInput input) {
        return new Pet("pet-new", input.name(), "available", input.age(), input.tags());
    }

    @Operation(summary = "Get a pet", tags = "Pets")
    @ApiResponse(responseCode = "200", description = "Pet returned")
    @GetMapping("/pets/{petId}")
    public Pet getPet(
            @Parameter(description = "Pet identifier", required = true)
            @PathVariable String petId) {
        return new Pet(petId, "Miso", "available", 3, List.of("friendly"));
    }

    @Operation(summary = "Upload a pet photo", description = "Exercises multipart/form-data", tags = "Forms")
    @ApiResponse(responseCode = "201", description = "Upload metadata returned")
    @PostMapping(value = "/uploads", consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> upload(
            @Parameter(description = "Image file", required = true)
            @RequestParam MultipartFile file,
            @Parameter(description = "Photo caption")
            @RequestParam(defaultValue = "Miso at the park") String caption) {
        return Map.of(
                "id", "upload-local",
                "filename", file.getOriginalFilename() == null ? "upload.bin" : file.getOriginalFilename(),
                "caption", caption);
    }

    public record PetInput(
            @Schema(description = "Pet name", example = "Miso", minLength = 1)
            String name,
            @Schema(description = "Pet age", example = "3", minimum = "0")
            int age,
            @Schema(description = "Pet tags", example = "[\"friendly\",\"adoptable\"]")
            List<String> tags) {
    }

    public record Pet(
            @Schema(description = "Pet identifier", example = "pet-1", accessMode = Schema.AccessMode.READ_ONLY)
            String id,
            @Schema(description = "Pet name", example = "Miso")
            String name,
            @Schema(description = "Pet status", example = "available", allowableValues = {"available", "pending", "adopted"})
            String status,
            @Schema(description = "Pet age", example = "3", minimum = "0")
            int age,
            List<String> tags) {
    }
}
