package edu.xtd.facturacion360.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import edu.xtd.facturacion360.controller.filtro.FiltroQR;

@Configuration
public class FiltrosConfig {

    @Bean
    public FilterRegistrationBean<FiltroQR> tiempoQrFilter() {
        FilterRegistrationBean<FiltroQR> registro =
                new FilterRegistrationBean<>();

        registro.setFilter(new FiltroQR());
        registro.addUrlPatterns("/verifactu/qr/*");

        return registro;
    }
}