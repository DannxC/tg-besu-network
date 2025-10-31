/* eslint-env browser */
/**
 * Lógica principal do dashboard
 */

// Estado da aplicação
const appState = {
  precision: 4,  // Default precision = 4
  contractLoaded: false,
  gridInitialized: false,
  accordionSetup: false,  // Flag para evitar setup duplicado
  initialized: false  // Flag para evitar init duplicado
};

/**
 * Inicializa o dashboard
 */
async function init() {
  // Evitar inicialização duplicada
  if (appState.initialized) {
    return;
  }
  
  appState.initialized = true;
  
  // Carregar contrato
  try {
    await loadContractData();
  } catch (error) {
    showError('Erro ao carregar contrato: ' + error.message);
    return;
  }
  
  // Inicializar canvas e grid
  initCanvas();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Inicializar ProcessPolygon handler
  if (window.ProcessPolygonHandler) {
    window.ProcessPolygonHandler.init();
    logMessage('ProcessPolygon handler inicializado');
  }
  
  // Desenhar grid inicial
  renderGrid();
}

/**
 * Carrega dados do contrato
 */
async function loadContractData() {
  const contractInfo = await GeohashContract.loadContract();
  
  // CRÍTICO: Sincronizar precision do contrato com o frontend!
  // O contrato tem gridCellLatSize/gridCellLonSize calculados com base na precision do deploy.
  // Se o frontend usar uma precision diferente, as conversões lat/lon <-> geohash ficam erradas!
  if (contractInfo && contractInfo.precision) {
    console.log(`🔄 Sincronizando precision: frontend ${appState.precision} → contrato ${contractInfo.precision}`);
    appState.precision = contractInfo.precision;
  }
  
  // Atualizar UI com info do contrato
  updateContractInfo(contractInfo);
  
  appState.contractLoaded = true;
}

/**
 * Inicializa o canvas
 */
function initCanvas() {
  const canvas = document.getElementById('canvas');
  if (!canvas) {
    console.error('Canvas não encontrado!');
    return;
  }
  GeohashGrid.initGrid(canvas);
  appState.gridInitialized = true;
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
  // Accordion
  setupAccordion();
  
  // Botões flutuantes removidos (não são mais necessários)
  // Modal de configurações removido - precision é fixada pelo contrato
}

/**
 * Configura accordion da sidebar
 */
function setupAccordion() {
  // Evitar setup duplicado
  if (appState.accordionSetup) {
    return;
  }
  
  appState.accordionSetup = true;
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  
  accordionHeaders.forEach(header => {
    const section = header.dataset.section;
    const content = document.getElementById(`${section}-section`);
    
    if (!content) {
      console.error(`Content não encontrado para ${section}`);
      return;
    }
    
    // Sincronizar estado inicial usando display direto
    const headerIsActive = header.classList.contains('active');
    
    if (headerIsActive) {
      content.classList.add('active');
      content.style.display = 'block';
    } else {
      content.classList.remove('active');
      content.style.display = 'none';
    }
    
    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isActive = header.classList.contains('active');
      
      // Toggle usando display direto
      if (isActive) {
        // Fechar
        header.classList.remove('active');
        content.classList.remove('active');
        content.style.display = 'none';
      } else {
        // Abrir
        header.classList.add('active');
        content.classList.add('active');
        content.style.display = 'block';
      }
    });
  });
}

/**
 * Renderiza o grid
 */
function renderGrid() {
  if (!appState.gridInitialized) {
    console.error('Canvas não inicializado');
    return;
  }
  
  // Validar precision
  if (!GeohashUtils.isValidPrecision(appState.precision)) {
    showError(`Precision inválida: ${appState.precision}. Deve ser par entre 2-16.`);
    return;
  }
  
  // Desenhar grid
  GeohashGrid.drawGrid(appState.precision);
  
  // Atualizar info do grid
  updateGridInfo();
}

/**
 * Atualiza informações do contrato na UI
 */
function updateContractInfo(contractInfo) {
  const addressEl = document.getElementById('contract-address');
  const precisionEl = document.getElementById('contract-precision');
  const networkEl = document.getElementById('contract-network');
  const currentPrecisionEl = document.getElementById('current-precision');
  
  if (addressEl) {
    addressEl.textContent = contractInfo.address.slice(0, 10) + '...';
    addressEl.title = contractInfo.address;
  }
  
  if (precisionEl) {
    precisionEl.textContent = contractInfo.precision;
  }
  
  if (networkEl) {
    networkEl.textContent = `${contractInfo.network} (${contractInfo.chainId})`;
  }
  
  // Atualizar também o display de precision atual na sidebar
  if (currentPrecisionEl) {
    currentPrecisionEl.textContent = contractInfo.precision;
  }
}

/**
 * Atualiza informações do grid na UI
 */
function updateGridInfo() {
  const gridCountEl = document.getElementById('grid-count');
  const cellSizeEl = document.getElementById('cell-size');
  const totalCellsEl = document.getElementById('total-cells');
  
  const gridCount = GeohashUtils.getGridCount(appState.precision);
  const cellSize = GeohashUtils.getCellSize(appState.precision);
  const totalCells = gridCount * gridCount;
  
  if (gridCountEl) {
    gridCountEl.textContent = `${gridCount}x${gridCount}`;
  } else {
    console.error('grid-count element não encontrado!');
  }
  
  if (cellSizeEl) {
    cellSizeEl.textContent = `${cellSize.width.toFixed(1)}x${cellSize.height.toFixed(1)}px`;
  } else {
    console.error('cell-size element não encontrado!');
  }
  
  if (totalCellsEl) {
    totalCellsEl.textContent = totalCells.toLocaleString();
  } else {
    console.error('total-cells element não encontrado!');
  }
}

/**
 * Exibe mensagem de erro
 */
function showError(message) {
  console.error(message);
  logMessage(`ERRO: ${message}`, 'error');
}

/**
 * Adiciona mensagem ao log
 */
function logMessage(message, type = 'info') {
  const logEl = document.getElementById('log');
  if (!logEl) return;
  
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  
  // Limitar a 50 mensagens
  while (logEl.children.length > 50) {
    logEl.removeChild(logEl.firstChild);
  }
}

// Exportar appState para uso global
if (typeof window !== 'undefined') {
  window.appState = appState;
}

// Inicializar quando o DOM estiver pronto (apenas uma vez)
let initListenerAdded = false;

if (document.readyState === 'loading') {
  if (!initListenerAdded) {
    document.addEventListener('DOMContentLoaded', init, { once: true });
    initListenerAdded = true;
  }
} else {
  // DOM já está pronto, inicializar imediatamente
  init();
}

// Fallback REMOVIDO - não é necessário e pode causar múltiplas inicializações
// A proteção com appState.initialized já é suficiente
