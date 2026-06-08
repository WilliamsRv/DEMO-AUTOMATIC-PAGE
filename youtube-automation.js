import { chromium, firefox, webkit } from 'playwright';
import { execSync } from 'child_process';

// Función para detectar navegador disponible
function detectBrowser() {
    const browserEnv = process.env.BROWSER?.toLowerCase();
    
    if (browserEnv === 'brave') {
        try {
            // Buscar Brave en rutas comunes de Linux
            const bravePaths = [
                '/usr/bin/brave-browser',
                '/usr/bin/brave',
                '/opt/brave.com/brave/brave-browser',
                '/snap/bin/brave',
                `${process.env.HOME}/.local/share/flatpak/exports/bin/com.brave.Browser`
            ];
            
            for (const path of bravePaths) {
                try {
                    execSync(`which ${path} 2>/dev/null || test -x ${path}`, { stdio: 'ignore' });
                    return { type: 'brave', executablePath: path };
                } catch {}
            }
            
            // Intentar encontrar con which
            const result = execSync('which brave-browser 2>/dev/null || which brave 2>/dev/null', { 
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            }).trim();
            
            if (result) {
                return { type: 'brave', executablePath: result };
            }
        } catch {}
        console.log('⚠️  Brave no encontrado, usando Chromium como respaldo');
    }
    
    // Detectar según variable de entorno o usar Chromium por defecto
    switch (browserEnv) {
        case 'firefox':
            return { type: 'firefox', launcher: firefox };
        case 'webkit':
            return { type: 'webkit', launcher: webkit };
        default:
            return { type: 'chromium', launcher: chromium };
    }
}

(async () => {
    console.log('🚀 Iniciando automatización multi-navegador...\n');
    
    const browserConfig = detectBrowser();
    console.log(`🌐 Navegador seleccionado: ${browserConfig.type.toUpperCase()}\n`);

    let browser;
    let context;
    let page;

    try {
        // PASO 1: Inicializar navegador
        console.log('📌 Paso 1: Inicializando navegador...');
        
        const launchOptions = {
            headless: false,
            args: ['--start-maximized', '--no-sandbox']
        };

        // Si es Brave, usar executablePath
        if (browserConfig.type === 'brave' && browserConfig.executablePath) {
            launchOptions.executablePath = browserConfig.executablePath;
            browser = await chromium.launch(launchOptions);
        } else if (browserConfig.launcher) {
            browser = await browserConfig.launcher.launch(launchOptions);
        } else {
            browser = await chromium.launch(launchOptions);
        }

        context = await browser.newContext({
            viewport: { width: 1280, height: 800 }
        });
        page = await context.newPage();
        console.log('✅ Navegador abierto correctamente\n');

        // PASO 2: Navegar a YouTube
        console.log('📌 Paso 2: Navegando a YouTube...');
        await page.goto('https://www.youtube.com', { 
            waitUntil: 'networkidle' 
        });
        const pageTitle = await page.title();
        console.log(`✅ YouTube cargado: "${pageTitle}"\n`);

        // PASO 3: Interactuar - Buscar "instituto vallegrande"
        console.log('📌 Paso 3: Realizando búsqueda...');
        
        // Esperar input de búsqueda (diferentes selectores posibles)
        const searchSelectors = [
            'input#search',
            'input[name="search_query"]',
            'input[aria-label="Search"]',
            '#search-input input',
            'input.search'
        ];
        
        let searchInput = null;
        for (const selector of searchSelectors) {
            try {
                searchInput = await page.waitForSelector(selector, { timeout: 3000 });
                if (searchInput) {
                    console.log(`   Selector encontrado: ${selector}`);
                    break;
                }
            } catch {}
        }
        
        if (!searchInput) {
            // Si no encuentra el selector, intentar hacer clic en el ícono de búsqueda primero
            await page.click('button#search-icon-legacy, button[aria-label="Search"]');
            await page.waitForTimeout(500);
            searchInput = await page.waitForSelector('input#search, input[name="search_query"]', { timeout: 5000 });
        }
        
        // Clic en barra de búsqueda y escribir
        await searchInput.click();
        await searchInput.fill('instituto vallegrande');
        
        // Presionar ENTER
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle');
        console.log('✅ Búsqueda realizada: "instituto vallegrande"\n');

        // PASO 4: Hacer clic en el primer video
        console.log('📌 Paso 4: Abriendo primer video...');
        
        // Esperar a que aparezcan los videos en los resultados
        await page.waitForSelector('ytd-video-renderer', { timeout: 10000 });
        
        // Obtener el primer video y hacer clic
        const firstVideo = await page.$('ytd-video-renderer a#video-title');
        if (firstVideo) {
            const videoTitle = await firstVideo.getAttribute('title');
            console.log(`   Video: "${videoTitle}"`);
            await firstVideo.click();
            await page.waitForLoadState('networkidle');
            console.log('✅ Primer video abierto\n');
        }

        // PASO 5: Pausar el video
        console.log('📌 Paso 5: Pausando video...');
        
        // Esperar a que el reproductor cargue
        await page.waitForSelector('#movie_player', { timeout: 10000 });
        await page.waitForTimeout(3000); // Esperar que el video comience a reproducirse
        
        // Hacer clic en el video para pausarlo (o usar el botón de pausa)
        const player = await page.$('#movie_player');
        if (player) {
            // El video se pausa haciendo clic en él o en el botón de pausa
            await page.click('#movie_player');
            await page.waitForTimeout(500);
            console.log('✅ Video pausado\n');
        }

        // PASO 5: Finalizar
        console.log('📌 Paso 5: Cerrando navegador...');
        await browser.close();
        console.log('✅ Navegador cerrado correctamente');
        console.log('\n🎉 ¡Automatización completada exitosamente!');

    } catch (error) {
        console.error('❌ Error durante la automatización:', error.message);
        if (browser) await browser.close();
        process.exit(1);
    }
})();
