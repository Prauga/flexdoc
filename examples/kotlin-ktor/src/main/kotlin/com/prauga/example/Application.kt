package com.prauga.example

import com.prauga.flexdoc.jvm.FlexDocConfig
import com.prauga.flexdoc.jvm.FlexDocHost
import com.prauga.flexdoc.jvm.FlexDocHttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.request.path
import io.ktor.server.response.respondBytes
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing

fun Application.module() {
    val host = FlexDocHost(
        FlexDocConfig.builder()
            .path("/docs")
            .specUrl("/openapi.json")
            .title("Ktor FlexDoc Example")
            .theme("system")
            .build()
    )

    routing {
        get("/openapi.json") {
            call.respondText(
                """{"openapi":"3.1.0","info":{"title":"Ktor FlexDoc Example","version":"1.0.0"},"paths":{}}""",
                ContentType.Application.Json,
            )
        }
        get("/docs") { call.respondFlexDoc(host.documentation()) }
        get("/docs/") { call.respondFlexDoc(host.documentation()) }
        get("/docs/__flexdoc/renderer.js") { call.respondFlexDoc(host.rendererJavaScript()) }
        get("/docs/__flexdoc/renderer.css") { call.respondFlexDoc(host.rendererCss()) }
    }
}

private suspend fun ApplicationCall.respondFlexDoc(response: FlexDocHttpResponse) {
    response.cacheControl()?.let { this.response.headers.append(HttpHeaders.CacheControl, it) }
    respondBytes(
        bytes = response.body(),
        contentType = ContentType.parse(response.contentType()),
        status = HttpStatusCode.fromValue(response.status()),
    )
}

fun main() {
    embeddedServer(Netty, host = "127.0.0.1", port = 5088, module = Application::module).start(wait = true)
}
