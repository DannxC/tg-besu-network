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
    console.log('Dashboard já inicializado, pulando...');
    return;
  }
  
  appState.initialized = true;
  console.log('Inicializando dashboard...');
  
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
  
  // Inicializar test handler
  if (window.TestHandler) {
    TestHandler.init();
    logMessage('Test handler inicializado');
  }
  
  // Desenhar grid inicial
  renderGrid();
  
  console.log('Dashboard inicializado com sucesso!');
}

/**
 * Carrega dados do contrato
 */
async function loadContractData() {
  console.log('loadContractData() iniciado');
  const contractInfo = await GeohashContract.loadContract();
  console.log('Contrato carregado:', contractInfo);
  
  // Atualizar UI com info do contrato
  updateContractInfo(contractInfo);
  
  appState.contractLoaded = true;
  console.log('appState.contractLoaded = true');
  // Manter precision default = 4 (já definido no appState inicial)
}

/**
 * Inicializa o canvas
 */
function initCanvas() {
  console.log('initCanvas() chamado');
  const canvas = document.getElementById('canvas');
  if (!canvas) {
    console.error('Canvas não encontrado!');
    return;
  }
  console.log('Canvas encontrado:', canvas);
  GeohashGrid.initGrid(canvas);
  appState.gridInitialized = true;
  console.log('Canvas inicializado, gridInitialized =', appState.gridInitialized);
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
  // Accordion
  setupAccordion();
  
  // Modal de configurações
  setupSettingsModal();
  
  // Botão de refresh flutuante
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Se estiver na tab bounding box, resetar estado
      if (window.testState && window.testState.activeTab === 'bounding-box') {
        if (window.bboxState) {
          window.bboxState.points = [];
          window.bboxState.isDrawing = false;
          window.bboxState.isLocked = false;
          window.bboxState.snapPoint = null;
          window.bboxState.calculatedBBox = null;
          
          // Resetar visibilidade
          if (window.updateBBoxInputMode) {
            window.updateBBoxInputMode();
          }
          
          const snapCoords = document.getElementById('snap-coords');
          if (snapCoords) snapCoords.style.display = 'none';
        }
      }
      
      renderGrid();
      logMessage('Grid atualizado');
    });
  }
}

/**
 * Configura accordion da sidebar
 */
function setupAccordion() {
  // Evitar setup duplicado
  if (appState.accordionSetup) {
    console.log('Accordion já configurado, pulando...');
    return;
  }
  
  appState.accordionSetup = true;
  console.log('setupAccordion() chamado');
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  console.log('Accordion headers encontrados:', accordionHeaders.length);
  
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
      console.log(`Accordion ${section}: INICIALIZADO COMO ATIVO`);
    } else {
      content.classList.remove('active');
      content.style.display = 'none';
      console.log(`Accordion ${section}: INICIALIZADO COMO INATIVO`);
    }
    
    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Accordion clicado:', section);
      const isActive = header.classList.contains('active');
      console.log('Estado atual isActive:', isActive);
      
      // Toggle usando display direto
      if (isActive) {
        // Fechar
        header.classList.remove('active');
        content.classList.remove('active');
        content.style.display = 'none';
        console.log(`FECHADO ${section}`);
      } else {
        // Abrir
        header.classList.add('active');
        content.classList.add('active');
        content.style.display = 'block';
        console.log(`ABERTO ${section}`);
      }
    });
  });
}

/**
 * Configura modal de configurações
 */
function setupSettingsModal() {
  const settingsBtn = document.getElementById('settings-btn');
  const modal = document.getElementById('settings-modal');
  const closeBtn = document.getElementById('close-modal');
  const applyBtn = document.getElementById('apply-settings');
  const precisionInput = document.getElementById('precision-input');
  const precisionValue = document.getElementById('precision-value');
  
  // Obter max precision do contrato
  const maxPrecision = GeohashContract.getMaxPrecision() || 16;
  
  // Atualizar atributos do input
  precisionInput.setAttribute('max', maxPrecision.toString());
  
  // Abrir modal
  settingsBtn.addEventListener('click', () => {
    modal.classList.add('active');
    // Sincronizar valor atual
    precisionInput.value = appState.precision;
    precisionValue.textContent = appState.precision;
  });
  
  // Fechar modal
  const closeModal = () => {
    modal.classList.remove('active');
  };
  
  closeBtn.addEventListener('click', closeModal);
  
  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Atualizar valor do slider
  precisionInput.addEventListener('input', (e) => {
    let value = parseInt(e.target.value);
    
    // Validar: deve ser par
    if (value % 2 !== 0) {
      value = value - 1;
    }
    
    // Validar limites (min=2, max=maxPrecision do contrato)
    value = Math.max(2, Math.min(maxPrecision, value));
    
    e.target.value = value;
    precisionValue.textContent = value;
  });
  
  // Aplicar configurações
  applyBtn.addEventListener('click', () => {
    const newPrecision = parseInt(precisionInput.value);
    
    // Validar contra max precision do contrato
    if (newPrecision > maxPrecision) {
      logMessage(`⚠️ Precision máxima do contrato: ${maxPrecision}`, 'error');
      return;
    }
    
    if (newPrecision !== appState.precision) {
      appState.precision = newPrecision;
      
      // Atualizar display na sidebar
      const currentPrecisionEl = document.getElementById('current-precision');
      if (currentPrecisionEl) {
        currentPrecisionEl.textContent = newPrecision;
      }
      
      // Re-renderizar grid
      renderGrid();
      
      logMessage(`Precision alterada para: ${newPrecision}`);
    }
    
    closeModal();
  });
}

/**
 * Renderiza o grid
 */
function renderGrid() {
  console.log('renderGrid() chamado, precision:', appState.precision);
  if (!appState.gridInitialized) {
    console.error('Canvas não inicializado');
    return;
  }
  
  // Validar precision
  if (!GeohashUtils.isValidPrecision(appState.precision)) {
    showError(`Precision inválida: ${appState.precision}. Deve ser par entre 2-16.`);
    return;
  }
  
  console.log('Chamando GeohashGrid.drawGrid()...');
  // Desenhar grid
  GeohashGrid.drawGrid(appState.precision);
  console.log('Grid desenhado!');
  
  // Atualizar info do grid
  updateGridInfo();
  console.log('Grid info atualizado');
}

/**
 * Atualiza informações do contrato na UI
 */
function updateContractInfo(contractInfo) {
  const addressEl = document.getElementById('contract-address');
  const precisionEl = document.getElementById('contract-precision');
  const networkEl = document.getElementById('contract-network');
  
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
}

/**
 * Atualiza informações do grid na UI
 */
function updateGridInfo() {
  console.log('updateGridInfo() chamado');
  const gridCountEl = document.getElementById('grid-count');
  const cellSizeEl = document.getElementById('cell-size');
  const totalCellsEl = document.getElementById('total-cells');
  
  const gridCount = GeohashUtils.getGridCount(appState.precision);
  const cellSize = GeohashUtils.getCellSize(appState.precision);
  const totalCells = gridCount * gridCount;
  
  console.log('Grid Info:', { gridCount, cellSize, totalCells });
  
  if (gridCountEl) {
    gridCountEl.textContent = `${gridCount}x${gridCount}`;
    console.log('grid-count atualizado:', gridCountEl.textContent);
  } else {
    console.error('grid-count element não encontrado!');
  }
  
  if (cellSizeEl) {
    cellSizeEl.textContent = `${cellSize.width.toFixed(1)}x${cellSize.height.toFixed(1)}px`;
    console.log('cell-size atualizado:', cellSizeEl.textContent);
  } else {
    console.error('cell-size element não encontrado!');
  }
  
  if (totalCellsEl) {
    totalCellsEl.textContent = totalCells.toLocaleString();
    console.log('total-cells atualizado:', totalCellsEl.textContent);
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

