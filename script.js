// Seleccionar elementos HTML del DOM
const messageForm = document.querySelector(".prompt__form"); // Formulario donde el usuario ingresa su mensaje
const chatHistoryContainer = document.querySelector(".chats"); // Contenedor para mostrar el historial de chats
const suggestionItems = document.querySelectorAll(".suggests__item"); // Lista de elementos de sugerencias

// Botones de acción
const themeToggleButton = document.getElementById("themeToggler"); // Botón para cambiar entre temas claro y oscuro
const clearChatButton = document.getElementById("deleteButton"); // Botón para borrar el historial de chats

// Variables de estado
let currentUserMessage = null; // Almacena el mensaje actual del usuario
let isGeneratingResponse = false; // Indica si el sistema está generando una respuesta

// Claves y URLs de la API
const GOOGLE_API_KEY = "AIzaSyCQMvaumj4X8qpMPr2iLvQ91qAau4aDfz8";
const API_REQUEST_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`;

// Cargar historial de chats guardados desde el almacenamiento local
const loadSavedChatHistory = () => {
    const savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || []; // Recuperar chats guardados o inicializar vacío
    const isLightTheme = localStorage.getItem("themeColor") === "light_mode"; // Comprobar si el tema claro está activado

    document.body.classList.toggle("light_mode", isLightTheme); // Activar tema claro si corresponde
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>'; // Actualizar icono del tema

    chatHistoryContainer.innerHTML = ''; // Limpiar contenedor del historial de chats

    // Iterar a través del historial de chats guardados y mostrarlos
    savedConversations.forEach(conversation => {
        // Mostrar mensaje del usuario
        const userMessageHtml = `
            <div class="message__content">
                <img class="message__avatar" src="assets/gengar.png" alt="User avatar">
                <p class="message__text">${conversation.userMessage}</p>
            </div>
        `;
        const outgoingMessageElement = createChatMessageElement(userMessageHtml, "message--outgoing");
        chatHistoryContainer.appendChild(outgoingMessageElement);

        // Mostrar respuesta de la API
        const responseText = conversation.apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text; // Extraer texto de la respuesta
        const parsedApiResponse = marked.parse(responseText); // Convertir a HTML
        const rawApiResponse = responseText; // Guardar texto sin procesar

        const responseHtml = `
           <div class="message__content">
                <img class="message__avatar" src="assets/gemini.svg" alt="Gemini avatar">
                <p class="message__text"></p>
                <div class="message__loading-indicator hide">
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                </div>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>
        `;
        const incomingMessageElement = createChatMessageElement(responseHtml, "message--incoming");
        chatHistoryContainer.appendChild(incomingMessageElement);

        const messageTextElement = incomingMessageElement.querySelector(".message__text");

        // Mostrar historial guardado sin efecto de escritura
        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement, true); // 'true' omite el efecto de escritura
    });

    // Mostrar u ocultar el encabezado basado en si hay chats guardados
    document.body.classList.toggle("hide-header", savedConversations.length > 0);
};

// Crear un nuevo elemento de mensaje de chat
const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", ...cssClasses);
    messageElement.innerHTML = htmlContent;
    return messageElement;
};

// Mostrar efecto de escritura
const showTypingEffect = (rawText, htmlText, messageElement, incomingMessageElement, skipEffect = false) => {
    const copyIconElement = incomingMessageElement.querySelector(".message__icon");
    copyIconElement.classList.add("hide"); // Ocultar botón de copiar inicialmente

    if (skipEffect) {
        // Mostrar contenido directamente sin efecto de escritura
        messageElement.innerHTML = htmlText;
        hljs.highlightAll(); // Resaltar sintaxis en bloques de código
        addCopyButtonToCodeBlocks(); // Añadir botón de copiar
        copyIconElement.classList.remove("hide"); // Mostrar botón de copiar
        isGeneratingResponse = false;
        return;
    }

    // Efecto de escritura palabra por palabra
    const wordsArray = rawText.split(' ');
    let wordIndex = 0;

    const typingInterval = setInterval(() => {
        messageElement.innerText += (wordIndex === 0 ? '' : ' ') + wordsArray[wordIndex++];
        if (wordIndex === wordsArray.length) {
            clearInterval(typingInterval); // Detener intervalo
            isGeneratingResponse = false;
            messageElement.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            copyIconElement.classList.remove("hide");
        }
    }, 75); // Velocidad de escritura en milisegundos
};

// Las demás funciones tienen un propósito similar: manejar la generación de respuestas, animaciones de carga, cambio de tema y copia de mensajes al portapapeles.


// Fetch API response based on user input
const requestApiResponse = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message__text");

    try {
        const response = await fetch(API_REQUEST_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: currentUserMessage }] }]
            }),
        });

        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.error.message);

        const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("Invalid API response.");

        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;

        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement);

        // Save conversation in local storage
        let savedConversations = JSON.parse(localStorage.getItem("saved-api-chats")) || [];
        savedConversations.push({
            userMessage: currentUserMessage,
            apiResponse: responseData
        });
        localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
    } catch (error) {
        isGeneratingResponse = false;
        messageTextElement.innerText = error.message;
        messageTextElement.closest(".message").classList.add("message--error");
    } finally {
        incomingMessageElement.classList.remove("message--loading");
    }
};


const addCopyButtonToCodeBlocks = () => {
    const codeBlocks = document.querySelectorAll('pre');
    codeBlocks.forEach((block) => {
        const codeElement = block.querySelector('code');
        let language = [...codeElement.classList].find(cls => cls.startsWith('language-'))?.replace('language-', '') || 'Text';

        const languageLabel = document.createElement('div');
        languageLabel.innerText = language.charAt(0).toUpperCase() + language.slice(1);
        languageLabel.classList.add('code__language-label');
        block.appendChild(languageLabel);

        const copyButton = document.createElement('button');
        copyButton.innerHTML = `<i class='bx bx-copy'></i>`;
        copyButton.classList.add('code__copy-btn');
        block.appendChild(copyButton);

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                copyButton.innerHTML = `<i class='bx bx-check'></i>`;
                setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy'></i>`, 2000);
            }).catch(err => {
                console.error("Copy failed:", err);
                alert("Unable to copy text!");
            });
        });
    });
};

// Show loading animation during API request
const displayLoadingAnimation = () => {
    const loadingHtml = `

        <div class="message__content">
            <img class="message__avatar" src="assets/gemini.svg" alt="Gemini avatar">
            <p class="message__text"></p>
            <div class="message__loading-indicator">
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
            </div>
        </div>
        <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>
    
    `;

    const loadingMessageElement = createChatMessageElement(loadingHtml, "message--incoming", "message--loading");
    chatHistoryContainer.appendChild(loadingMessageElement);

    requestApiResponse(loadingMessageElement);
};

const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.parentElement.querySelector(".message__text").innerText;

    navigator.clipboard.writeText(messageContent);
    copyButton.innerHTML = `<i class='bx bx-check'></i>`; 
    setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`, 1000); 
};


const handleOutgoingMessage = () => {
    currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim() || currentUserMessage;
    if (!currentUserMessage || isGeneratingResponse) return;

    isGeneratingResponse = true;

    const outgoingMessageHtml = `
    
        <div class="message__content">
            <img class="message__avatar" src="assets/gengar.png" alt="User avatar">
            <p class="message__text"></p>
        </div>

    `;

    const outgoingMessageElement = createChatMessageElement(outgoingMessageHtml, "message--outgoing");
    outgoingMessageElement.querySelector(".message__text").innerText = currentUserMessage;
    chatHistoryContainer.appendChild(outgoingMessageElement);

    messageForm.reset(); 
    document.body.classList.add("hide-header");
    setTimeout(displayLoadingAnimation, 500); 
};

themeToggleButton.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

   
    const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    themeToggleButton.querySelector("i").className = newIconClass;
});


clearChatButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all chat history?")) {
        localStorage.removeItem("saved-api-chats");


        loadSavedChatHistory();

        currentUserMessage = null;
        isGeneratingResponse = false;
    }
});


suggestionItems.forEach(suggestion => {
    suggestion.addEventListener('click', () => {
        currentUserMessage = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutgoingMessage();
    });
});


messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});


loadSavedChatHistory();
