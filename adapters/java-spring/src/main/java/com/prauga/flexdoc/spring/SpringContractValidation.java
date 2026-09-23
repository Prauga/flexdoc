package com.prauga.flexdoc.spring;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Ports the Node runtime-contract validator. Path-parameter names are ignored for route identity.
 * Acknowledged undocumented routes stay registered and are reported as informational findings.
 */
final class SpringContractValidation {
  private SpringContractValidation() {}

  static Map<String, Object> validate(
      List<SpringRuntimeIntelligence.RuntimeRoute> documentedRoutes,
      List<SpringRuntimeIntelligence.RuntimeRoute> runtimeRoutes,
      boolean discoveryComplete,
      List<SpringRuntimeIntelligence.RuntimeRoute> acknowledgedUndocumented) {
    Set<String> documentedKeys = new LinkedHashSet<>();
    for (SpringRuntimeIntelligence.RuntimeRoute route : documentedRoutes) documentedKeys.add(exactShapeKey(route));
    Set<String> runtimeKeys = new LinkedHashSet<>();
    for (SpringRuntimeIntelligence.RuntimeRoute route : runtimeRoutes) runtimeKeys.add(exactShapeKey(route));
    Set<String> acknowledgedKeys = new LinkedHashSet<>();
    for (SpringRuntimeIntelligence.RuntimeRoute route : acknowledgedUndocumented) acknowledgedKeys.add(exactShapeKey(route));

    List<Map<String, Object>> findings = new ArrayList<>();
    Map<String, List<String>> documentedMethods = groupedMethods(documentedRoutes);
    Map<String, List<String>> runtimeMethods = groupedMethods(runtimeRoutes);
    Set<String> methodMismatchShapes = new LinkedHashSet<>();

    for (Map.Entry<String, List<String>> entry : documentedMethods.entrySet()) {
      List<String> observedMethods = runtimeMethods.get(entry.getKey());
      if (observedMethods == null) continue;
      boolean hasExact = false;
      for (String method : entry.getValue()) {
        if (observedMethods.contains(method)) {
          hasExact = true;
          break;
        }
      }
      if (hasExact) continue;
      methodMismatchShapes.add(entry.getKey());
      String path = representativePath(documentedRoutes, entry.getKey());
      findings.add(finding(
          "runtime.method-mismatch",
          null,
          path,
          discoveryComplete ? "error" : "warning",
          entry.getValue().get(0),
          "Runtime route " + path + " is registered for different HTTP methods than OpenAPI documents.",
          entry.getValue(),
          observedMethods,
          null));
    }

    for (SpringRuntimeIntelligence.RuntimeRoute route : runtimeRoutes) {
      String shape = routeShape(route.path());
      if (methodMismatchShapes.contains(shape) || documentedKeys.contains(exactShapeKey(route))) continue;
      boolean acknowledged = acknowledgedKeys.contains(exactShapeKey(route));
      String severity = acknowledged ? "info" : (discoveryComplete ? "error" : "warning");
      findings.add(finding(
          "runtime.operation-undocumented",
          route.method(),
          route.path(),
          severity,
          route.method(),
          "Runtime implements " + route.method() + " " + route.path() + ", but OpenAPI does not document that operation.",
          "Operation is represented in OpenAPI",
          acknowledged
              ? "Operation exists only in the running backend and is acknowledged"
              : "Operation exists only in the running backend",
          acknowledged ? "acknowledged" : null));
    }

    for (SpringRuntimeIntelligence.RuntimeRoute route : documentedRoutes) {
      String shape = routeShape(route.path());
      if (methodMismatchShapes.contains(shape) || runtimeKeys.contains(exactShapeKey(route))) continue;
      findings.add(finding(
          "runtime.operation-unobserved",
          route.method(),
          route.path(),
          discoveryComplete ? "error" : "info",
          route.method(),
          discoveryComplete
              ? "OpenAPI documents " + route.method() + " " + route.path() + ", but the running backend does not expose that operation."
              : "OpenAPI documents " + route.method() + " " + route.path() + ", but it was not observed during partial runtime discovery.",
          "Operation is exposed by the running backend",
          discoveryComplete ? "No matching runtime operation exists" : "No matching operation was observed during partial discovery",
          null));
    }

    findings.sort(Comparator
        .comparingInt((Map<String, Object> finding) -> severityRank((String) finding.get("severity")))
        .thenComparing(finding -> location(finding).get("path"))
        .thenComparing(finding -> location(finding).getOrDefault("method", ""))
        .thenComparing(finding -> (String) finding.get("code")));

    int errors = 0;
    int warnings = 0;
    int info = 0;
    for (Map<String, Object> finding : findings) {
      switch ((String) finding.get("severity")) {
        case "error" -> errors++;
        case "warning" -> warnings++;
        default -> info++;
      }
    }
    String status = errors > 0 ? "fail" : warnings > 0 ? "warn" : !discoveryComplete ? "partial" : "pass";

    Map<String, Object> validation = new LinkedHashMap<>();
    validation.put("status", status);
    validation.put("complete", discoveryComplete);
    validation.put("findings", findings);
    validation.put("summary", Map.of("total", findings.size(), "errors", errors, "warnings", warnings, "info", info));
    return validation;
  }

  private static Map<String, Object> finding(
      String code,
      String idMethod,
      String path,
      String severity,
      String locationMethod,
      String message,
      Object expected,
      Object observed,
      String disposition) {
    Map<String, Object> finding = new LinkedHashMap<>();
    finding.put("id", code + ":" + (idMethod == null ? "" : idMethod + ":") + routeShape(path));
    finding.put("code", code);
    finding.put("severity", severity);
    Map<String, String> location = new LinkedHashMap<>();
    location.put("kind", "operation");
    location.put("path", path);
    if (locationMethod != null) location.put("method", locationMethod);
    finding.put("location", location);
    finding.put("message", message);
    finding.put("expected", expected);
    finding.put("observed", observed);
    if (disposition != null) finding.put("disposition", disposition);
    return finding;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, String> location(Map<String, Object> finding) {
    return (Map<String, String>) finding.get("location");
  }

  private static int severityRank(String severity) {
    return switch (severity) {
      case "error" -> 0;
      case "warning" -> 1;
      default -> 2;
    };
  }

  private static Map<String, List<String>> groupedMethods(List<SpringRuntimeIntelligence.RuntimeRoute> routes) {
    Map<String, Set<String>> grouped = new LinkedHashMap<>();
    for (SpringRuntimeIntelligence.RuntimeRoute route : routes) {
      grouped.computeIfAbsent(routeShape(route.path()), key -> new LinkedHashSet<>()).add(route.method().toUpperCase(Locale.ROOT));
    }
    Map<String, List<String>> methods = new LinkedHashMap<>();
    for (Map.Entry<String, Set<String>> entry : grouped.entrySet()) {
      List<String> sorted = new ArrayList<>(entry.getValue());
      sorted.sort(Comparator.naturalOrder());
      methods.put(entry.getKey(), sorted);
    }
    return methods;
  }

  private static String representativePath(List<SpringRuntimeIntelligence.RuntimeRoute> routes, String shape) {
    for (SpringRuntimeIntelligence.RuntimeRoute route : routes) {
      if (routeShape(route.path()).equals(shape)) return route.path();
    }
    return shape;
  }

  private static String exactShapeKey(SpringRuntimeIntelligence.RuntimeRoute route) {
    return route.method().toUpperCase(Locale.ROOT) + " " + routeShape(route.path());
  }

  private static String routeShape(String path) {
    return path.replaceAll("\\{[^/{}]+\\}", "{}");
  }
}
