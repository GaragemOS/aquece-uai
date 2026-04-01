# Use an official PHP image with Apache
FROM php:8.2.25-apache

# Instale extensões e dependências necessárias
RUN apt-get update && apt-get install -y \
    libzip-dev \
    libcurl4-openssl-dev \
    unzip \
    && docker-php-ext-install \
    zip \
    pdo_mysql \
    mysqli \
    curl

# Habilitar o mod_rewrite
RUN a2enmod rewrite

# Instalar nano
RUN apt-get install nano

# Reiniciar o apache
RUN service apache2 restart

RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html
