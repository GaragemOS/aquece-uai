FROM python:3.11-slim

# Instalar nano
RUN apt update && apt install nano -y

# Configurar o diretório de trabalho dentro do container
WORKDIR /app

# Copiar os arquivos de dependências para o container
COPY . .

# Instalar as dependências necessárias
#RUN pip install --no-cache-dir -r requirements.txt
RUN pip install -r requirements.txt

# Expor a porta em que o aplicativo será executado
EXPOSE 5000

# Definir o comando de inicialização
CMD ["python3", "app.py"]