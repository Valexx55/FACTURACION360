package edu.xtd.facturacion360.controller.filtro;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class FiltroQR extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FiltroQR.class);

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        long inicio = System.nanoTime();

        try {
            filterChain.doFilter(request, response);
        } finally {
            double tiempoMs = (System.nanoTime() - inicio)
                    / (double) TimeUnit.MILLISECONDS.toNanos(1);

            log.info("QR factura: {} {} | HTTP {} | {} ms",
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    String.format(java.util.Locale.ROOT, "%.2f", tiempoMs));
        }
    }
}