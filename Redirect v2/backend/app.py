from flask import Flask, render_template_string, abort
import requests

app = Flask(__name__)

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="pt-BR">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="mobile-web-app-capable" content="yes" />

		<link rel="icon" href="https://static.whatsapp.net/rsrc.php/v3/yz/r/ujTY9i_Jhs1.png" />
		<meta property="og:title" content="{{ projeto.nomeProjeto if projeto.nomeProjeto else projeto.nome }}" />
		<meta property="og:site_name" content="WhatsApp.com" />
		<meta property="og:image" content="{{ projeto.thumbProjeto }}" />
		<meta property="og:description" content="{{ projeto.descricaoProjeto if projeto.descricaoProjeto else 'WhatsApp Group Invite' }}" />

		<title>{{ projeto.nomeProjeto if projeto.nomeProjeto else projeto.nome }}</title>
		<meta name="description" content="{{ projeto.descricaoProjeto if projeto.descricaoProjeto else 'WhatsApp Group Invite' }}" />

		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

		<link rel="dns-prefetch" href="https://fonts.googleapis.com" />
		<link rel="dns-prefetch" href="https://fonts.gstatic.com" />
		<link
			href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&display=swap"
			rel="stylesheet"
		/>
		<noscript>
			<link
				href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&display=swap"
				rel="stylesheet"
			/>
		</noscript>
		<style>
			body {
				margin: 5vh 0;
				padding: 0;
				font-family: 'Montserrat', sans-serif;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: flex-start;
				min-height: 95vh;
				background-color: #f5f5f5;
				color: #333;
				text-align: center;
			}

			.container {
				max-width: 400px;
				margin: 20px;
			}

			.logo img {
				width: 200px;
				aspect-ratio: 1;
				background-color: #031e0d7c;
				display: inline-block;
				border-radius: 100%;
				margin-bottom: 20px;
			}

			.title {
				font-size: 1.5rem;
				margin-bottom: 40px;
			}

			.notranslate {
				unicode-bidi: isolate;
			}

			.actions {
				flex-direction: column;
				gap: 15px;
			}

			.button {
				display: block;
				width: 100%;
				padding: 15px;
				font-size: 1.2rem;
				margin-bottom: 15px;
				border-radius: 8px;
				border: none;
				cursor: pointer;
				transition: background-color 0.3s;
			}

			.button:focus {
				outline: none;
				box-shadow: 0 0 0 1px rgba(0, 255, 140, 0.5);
				border-radius: 8px;
				transition: box-shadow 0.3s ease;
			}

			.button-primary {
				background-color: #90ee90;
				color: #000;
			}

			.button-primary:hover {
				background-color: #32cd32;
			}

			.button-secondary {
				background-color: #f8f8f8;
				color: #333;
				border: 1px solid #ccc;
			}

			.button-secondary:hover {
				background-color: #e0e0e0;
			}

			.note {
				font-size: 0.75rem;
				color: #3f3f3f;
				text-align: center;
				line-height: 0.5;
			}

			.note a {
				color: #004b9b;
				text-decoration: none;
			}

			#popup {
				position: fixed;
				width: 60%;
				max-width: 300px;
				bottom: 20px;
				left: 50%;
				transform: translateX(-50%);
				background-color: #f8f8f8;
				color: black;
				padding: 15px 20px;
				border-radius: 8px;
				font-size: 1rem;
				box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
				opacity: 0;
				visibility: hidden;
				transition: opacity 0.5s ease, visibility 0.5s;
			}

			#popup.show {
				visibility: visible;
				opacity: 1;
			}
		</style>
	</head>
	<body>
		<main class="container">
			<header class="logo">
				<img
					src="{{ projeto.thumbProjeto if projeto.thumbProjeto else url_for('static', filename='default_thumbnail.png') }}"
					width="200"
					height="200"
					alt="Imagem do grupo {{ projeto.nomeProjeto if projeto.nomeProjeto else projeto.nome }}"
					onclick="enterGroup()"
				/>
			</header>

			<section aria-labelledby="launch-title">
				<h1 id="launch-title" class="title notranslate" onclick="enterGroup()">
					{{ projeto.nomeProjeto if projeto.nomeProjeto else projeto.nome }}
				</h1>

				<div class="actions">
					<button
						class="button button-primary"
						aria-label="Entrar no grupo do WhatsApp"
						aria-describedby="group-info"
						autofocus
						onclick="enterGroup()"
					>
						Entrar no grupo
					</button>

					<div>
						<button
							class="button button-secondary"
							aria-label="Copiar o link do grupo para WhatsApp"
							aria-describedby="group-info"
							onclick="copyToClipboard('https://chat.whatsapp.com/{{ projeto.linkConvite }}')"
						>
							Copiar o link do grupo
						</button>

						<div id="group-info" class="note">
							<p>Caso esteja com problemas para entrar no grupo,</p>
							<p>abra o WhatsApp e cole o link em uma conversa.</p>
							<p>Então clique no link para abrir direto no grupo.</p>
							<noscript>
								<p>Ative o JavaScript para uma melhor experiência.</p>
								<a
									href="https://chat.whatsapp.com/{{ projeto.linkConvite }}"
									target="_blank"
									rel="noopener noreferrer"
								>
									Clique aqui para entrar no grupo.
								</a>
							</noscript>
						</div>
					</div>

				</div>
			</section>

			<div id="popup" aria-live="polite" hidden>
				Link copiado. Abra o WhatsApp e cole o link em uma conversa.
			</div>
		</main>
		<script>
			try {
				setTimeout(() => (window.location.href = 'whatsapp://chat/?code={{ projeto.linkConvite }}'), 0.01);
			} catch (error) {
				console.error('ECL');
			}

			function cr(t, ld, d) {
				if (!window.clarity) return;
				if (!d) return window.clarity(t, ld);
				window.clarity(t, ld, d);
			}

			function showPopup() {
				const popup = document.getElementById('popup');
				popup.removeAttribute('hidden');
				popup.classList.add('show');

				setTimeout(() => popup.classList.remove('show'), 10_000);
			}

			function copyToClipboard(text) {
                console.log(text);
				navigator.clipboard
					.writeText(text)
					.then(() => {
						if (navigator.vibrate) {
							navigator.vibrate([30, 20, 30]);
							cr('event', 'vibrate');
						}
						showPopup();
						cr('event', 'copyLink');
					})
					.catch(err => console.error('ECL', err));
			}

			window.addEventListener('beforeunload', () => cr('event', 'leavePage'));

			function enterGroup() {
				const isPC = window.innerWidth > 1024;

				const url = isPC
					? 'https://web.whatsapp.com/accept?code={{ projeto.linkConvite }}'
					: 'https://chat.whatsapp.com/{{ projeto.linkConvite }}';

				window.location.href = 'whatsapp://chat/?code={{ projeto.linkConvite }}';
				setTimeout(() => (window.location.href = url), 500);

				cr('event', 'enterGroup');
				cr('set', 'ua', navigator.userAgent || 'unknown');
				window.isInstagram && cr('event', 'ig');
				window.isDarkMode && cr('event', 'darkMode');
				cr('set', 'browserLang', navigator.language || 'unknown');
			}

			function isNight() {
				const now = new Date();
				const hour = now.getHours();

				if (hour >= 6 && hour < 18) {
					return false;
				} else {
					return true;
				}
			}

			function isDark() {
				if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
					return true;
				} else {
					return false;
				}
			}

			if (isDark() && isNight()) {
				document.body.style.backgroundColor = 'black';
				document.body.style.color = 'white';
				document.querySelector('.button-primary').style.backgroundColor = '#195719';
				document.querySelector('.button-primary').style.color = 'white';
				document.querySelector('.button-secondary').style.backgroundColor = '#3330';
				document.querySelector('.button-secondary').style.color = 'white';
				document.querySelector('.button-secondary').style.border = '1px solid #333';

				document.querySelector('.note').style.color = '#ccc';
				document.querySelector('.note a').style.color = '#4fa4ff';

				window.isDarkMode = true;
			}
		</script>
	
<style>
  #google_translate_element,
  .skiptranslate {
    display: none;
  }
  body {
    top: 0 !important;
  }
</style>
<div id="google_translate_element"></div>
<script>
  function googleTranslateElementInit() {
    new google.translate.TranslateElement(
      {
        pageLanguage: "pt",
        includedLanguages: "en,es,fr,it,de,ja,zh,ru,pt",
        autoDisplay: false,
      },
      "google_translate_element"
    );

    const browserLanguage =
      (
        navigator.language ||
        navigator.userLanguage ||
        navigator.languages[0]
      )?.substring(0, 2) || "pt";

    const selectElementInterval = setInterval(function () {
      const selectElement = document.querySelector(
        "#google_translate_element select"
      );
      if (selectElement) {
        clearInterval(selectElementInterval);
        selectElement.value = browserLanguage;
        selectElement.dispatchEvent(new Event("change"));

        selectElement.addEventListener("change", () => {
          console.log(`${selectElement.value}`);
        });
      }
    }, 500);
  }
</script>
<script src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>
       </body>
</html>
"""

@app.route("/<slug>")
def redirect_group(slug):
    url = f"https://webhook.garagem.dev.br/webhook/18897666-36e0-4401-aa02-0521c54faec5?slug={slug}"
    response = requests.get(url)

    if response.status_code != 200:
        abort(404, description="Projeto não encontrado.")

    projeto = response.json()
    return render_template_string(HTML_TEMPLATE, projeto=projeto)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
