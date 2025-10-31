/* eslint-env browser */
/**
 * ProcessPolygon Handler - Testa a função processPolygon do GeohashConverter
 * 
 * Funções:
 * - Adicionar pontos (click ou manual)
 * - Chamar processPolygon(latitudes[], longitudes[], precision)
 * - Visualizar geohashes retornados
 * - Limpar estado
 */

// Estado do processPolygon
const polygonState = {
  points: [],           // Array de { lat, lon }
  inputMode: 'click',   // 'click' ou 'manual'
  snapPoint: null,      // Ponto de hover/preview
  geohashResults: [],   // Geohashes retornados pelo contrato
  isProcessing: false,  // Flag para evitar chamadas múltiplas
  initialized: false    // Flag de inicialização
};

/**
 * Inicializa o handler
 */
function initProcessPolygonHandler() {
  if (polygonState.initialized) {
    console.log('ProcessPolygon handler já inicializado');
    return;
  }
  
  console.log('Inicializando ProcessPolygon handler...');
  
  // Setup event listeners
  setupPolygonControls();
  setupCanvasInteraction();
  
  polygonState.initialized = true;
  console.log('ProcessPolygon handler inicializado!');
}

/**
 * Setup controles do polígono
 */
function setupPolygonControls() {
  // Input mode select
  const inputModeSelect = document.getElementById('polygon-input-mode-select');
  if (inputModeSelect) {
    inputModeSelect.addEventListener('change', (e) => {
      polygonState.inputMode = e.target.value;
      updatePolygonUI();
      
      if (polygonState.inputMode === 'click') {
        addLogEntry('Modo: Click no canvas para adicionar pontos', 'info');
      } else {
        addLogEntry('Modo: Preencha Lat/Lon manualmente', 'info');
      }
    });
  }
  
  // Botão de adicionar ponto manual
  const addManualBtn = document.getElementById('polygon-add-manual-btn');
  if (addManualBtn) {
    addManualBtn.addEventListener('click', addManualPoint);
  }
  
  // Botão de processar
  const processBtn = document.getElementById('polygon-process-btn');
  if (processBtn) {
    processBtn.addEventListener('click', processPolygon);
  }
  
  // Botão de limpar
  const clearBtn = document.getElementById('polygon-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearPolygon);
  }
}

/**
 * Setup interação com canvas
 */
function setupCanvasInteraction() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  
  // Click para adicionar ponto
  canvas.addEventListener('click', (e) => {
    if (polygonState.inputMode !== 'click') return;
    if (polygonState.isProcessing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Converter pixel para lat/lon
    const coords = GeohashUtils.pixelToLatLon(x, y);
    
    addPoint(coords.lat, coords.lon);
  });
  
  // Mousemove para preview
  canvas.addEventListener('mousemove', (e) => {
    if (polygonState.inputMode !== 'click') {
      polygonState.snapPoint = null;
      updateSnapCoords(null, null);
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const coords = GeohashUtils.pixelToLatLon(x, y);
    polygonState.snapPoint = coords;
    
    // Atualizar coordenadas na UI
    updateSnapCoords(coords.lat, coords.lon);
    
    // Re-desenhar grid com preview
    renderPolygonState();
  });
  
  // Mouseleave para limpar preview
  canvas.addEventListener('mouseleave', () => {
    polygonState.snapPoint = null;
    updateSnapCoords(null, null);
    renderPolygonState();
  });
}

/**
 * Adiciona ponto ao polígono
 */
function addPoint(lat, lon) {
  polygonState.points.push({ lat, lon });
  
  addLogEntry(`Ponto ${polygonState.points.length} adicionado: (${lat.toFixed(4)}, ${lon.toFixed(4)})`, 'success');
  
  updatePolygonUI();
  renderPolygonState();
}

/**
 * Adiciona ponto manual
 */
function addManualPoint() {
  const latInput = document.getElementById('polygon-manual-lat');
  const lonInput = document.getElementById('polygon-manual-lon');
  
  if (!latInput || !lonInput) return;
  
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  
  if (isNaN(lat) || isNaN(lon)) {
    addLogEntry('⚠️ Lat/Lon inválidos', 'error');
    return;
  }
  
  // Validar limites
  if (lat < -90 || lat > 90) {
    addLogEntry('⚠️ Latitude deve estar entre -90 e 90', 'error');
    return;
  }
  
  if (lon < -180 || lon > 180) {
    addLogEntry('⚠️ Longitude deve estar entre -180 e 180', 'error');
    return;
  }
  
  addPoint(lat, lon);
  
  // Limpar inputs
  latInput.value = '';
  lonInput.value = '';
  latInput.focus();
}

/**
 * Processa o polígono chamando o contrato
 */
async function processPolygon() {
  // Validar mínimo de pontos
  if (polygonState.points.length < 3) {
    addLogEntry('⚠️ Adicione pelo menos 3 pontos para processar', 'error');
    updateTestStatus('Mínimo 3 pontos necessários', 'error');
    return;
  }
  
  if (polygonState.isProcessing) {
    addLogEntry('⚠️ Já processando...', 'warning');
    return;
  }
  
  polygonState.isProcessing = true;
  updateTestStatus('⏳ Processando polígono...', 'loading');
  
  try {
    // Obter contrato
    const contract = GeohashContract.getContract();
    if (!contract) {
      throw new Error('Contrato não carregado');
    }
    
    // Obter precision atual
    const precision = window.appState.precision;
    
    // Preparar arrays de lat/lon
    const latitudes = [];
    const longitudes = [];
    
    for (const point of polygonState.points) {
      // Converter para int256 com DECIMALS_FACTOR (10^18)
      const latScaled = toInt256WithDecimals(point.lat);
      const lonScaled = toInt256WithDecimals(point.lon);
      
      latitudes.push(latScaled);
      longitudes.push(lonScaled);
    }
    
    addLogEntry(`📡 Chamando processPolygon com ${polygonState.points.length} pontos (precision=${precision})...`, 'info');
    console.log('Chamando processPolygon:', { latitudes, longitudes, precision });
    
    // Chamar função do contrato (é uma transação que retorna array)
    const tx = await contract.processPolygon(latitudes, longitudes, precision);
    
    addLogEntry('⏳ Aguardando confirmação da transação...', 'info');
    const receipt = await tx.wait();
    
    addLogEntry(`✅ Transação confirmada! Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()}`, 'success');
    
    // Extrair geohashes do resultado
    // Como processPolygon retorna bytes32[], precisamos decodificar os eventos ou fazer uma chamada view
    // Vamos fazer uma chamada callStatic para obter o retorno
    const geohashes = await contract.callStatic.processPolygon(latitudes, longitudes, precision);
    
    addLogEntry(`🎉 Processamento concluído! ${geohashes.length} geohashes retornados`, 'success');
    console.log('Geohashes retornados:', geohashes);
    
    // Salvar resultados
    polygonState.geohashResults = geohashes;
    
    // Atualizar UI
    updateTestStatus(`✅ ${geohashes.length} geohashes processados`, 'success');
    
    // Renderizar resultados no canvas
    renderPolygonState();
    
  } catch (error) {
    console.error('Erro ao processar polígono:', error);
    addLogEntry(`❌ Erro: ${error.message}`, 'error');
    updateTestStatus(`Erro: ${error.message}`, 'error');
  } finally {
    polygonState.isProcessing = false;
  }
}

/**
 * Converte número para int256 com DECIMALS_FACTOR (10^18)
 */
function toInt256WithDecimals(value) {
  const valueStr = value.toFixed(18);
  const [intPart, decPart = ''] = valueStr.split('.');
  const decPartPadded = decPart.padEnd(18, '0').substring(0, 18);
  const fullValueStr = intPart + decPartPadded;
  return ethers.BigNumber.from(fullValueStr);
}

/**
 * Converte bytes32 para Z-Order index
 */
function bytes32ToZOrderIndex(bytes32Hex, precision) {
  let hexStr;
  
  if (typeof bytes32Hex === 'object') {
    if (bytes32Hex.toHexString) {
      hexStr = bytes32Hex.toHexString();
    } else {
      hexStr = '0x' + bytes32Hex.toString(16);
    }
  } else {
    hexStr = bytes32Hex.toString();
  }
  
  const hex = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
  const fullValue = BigInt('0x' + hex);
  const mask = (BigInt(1) << BigInt(2 * precision)) - BigInt(1);
  const zOrderIndex = Number(fullValue & mask);
  
  return zOrderIndex;
}

/**
 * Limpa o polígono
 */
function clearPolygon() {
  polygonState.points = [];
  polygonState.geohashResults = [];
  polygonState.snapPoint = null;
  
  updatePolygonUI();
  renderPolygonState();
  
  addLogEntry('🗑️ Polígono limpo', 'info');
  updateTestStatus('Polígono limpo', 'normal');
}

/**
 * Atualiza UI do polígono
 */
function updatePolygonUI() {
  const pointsList = document.getElementById('polygon-points-list');
  if (!pointsList) return;
  
  // Limpar lista
  pointsList.innerHTML = '';
  
  // Adicionar pontos
  polygonState.points.forEach((point, index) => {
    const pointEl = document.createElement('div');
    pointEl.className = 'polygon-point';
    pointEl.innerHTML = `
      <span class="polygon-point-number">${index + 1}.</span>
      <span class="polygon-point-coords">
        Lat: ${point.lat.toFixed(4)}, Lon: ${point.lon.toFixed(4)}
      </span>
      <button class="polygon-point-remove" data-index="${index}">✕</button>
    `;
    
    // Botão de remover
    const removeBtn = pointEl.querySelector('.polygon-point-remove');
    removeBtn.addEventListener('click', () => {
      polygonState.points.splice(index, 1);
      polygonState.geohashResults = []; // Limpar resultados ao remover ponto
      updatePolygonUI();
      renderPolygonState();
      addLogEntry(`Ponto ${index + 1} removido`, 'info');
    });
    
    pointsList.appendChild(pointEl);
  });
  
  // Mostrar/esconder input manual
  const manualForm = document.getElementById('polygon-manual-form');
  if (manualForm) {
    manualForm.style.display = polygonState.inputMode === 'manual' ? 'flex' : 'none';
  }
  
  // Atualizar contador
  const counterEl = document.getElementById('polygon-points-count');
  if (counterEl) {
    counterEl.textContent = `${polygonState.points.length} pontos`;
  }
  
  // Habilitar/desabilitar botão de processar
  const processBtn = document.getElementById('polygon-process-btn');
  if (processBtn) {
    processBtn.disabled = polygonState.points.length < 3;
  }
}

/**
 * Renderiza estado do polígono no canvas
 */
function renderPolygonState() {
  // Re-desenhar grid base
  if (window.GeohashGrid && window.appState) {
    GeohashGrid.drawGrid(window.appState.precision);
  }
  
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const precision = window.appState.precision;
  
  // 1. Desenhar geohashes retornados (se houver)
  if (polygonState.geohashResults.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    
    polygonState.geohashResults.forEach(geohash => {
      const zOrderIndex = bytes32ToZOrderIndex(geohash, precision);
      const { gridX, gridY } = GeohashUtils.zOrderToGrid(zOrderIndex, precision);
      const { x, y, width, height } = GeohashUtils.gridToPixel(gridX, gridY, precision);
      
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(x, y, width, height);
    });
    
    ctx.restore();
  }
  
  // 2. Desenhar linhas do polígono
  if (polygonState.points.length > 0) {
    ctx.save();
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    
    // Primeiro ponto
    const firstPoint = GeohashUtils.latLonToPixel(
      polygonState.points[0].lat,
      polygonState.points[0].lon
    );
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    // Demais pontos
    for (let i = 1; i < polygonState.points.length; i++) {
      const point = GeohashUtils.latLonToPixel(
        polygonState.points[i].lat,
        polygonState.points[i].lon
      );
      ctx.lineTo(point.x, point.y);
    }
    
    // Fechar polígono
    if (polygonState.points.length > 2) {
      ctx.lineTo(firstPoint.x, firstPoint.y);
    }
    
    ctx.stroke();
    ctx.restore();
  }
  
  // 3. Desenhar pontos do polígono
  polygonState.points.forEach((point, index) => {
    const pixel = GeohashUtils.latLonToPixel(point.lat, point.lon);
    
    // Círculo do ponto
    ctx.save();
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Borda branca
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Número do ponto
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((index + 1).toString(), pixel.x, pixel.y);
    
    ctx.restore();
  });
  
  // 4. Desenhar ponto de preview (snapPoint)
  if (polygonState.snapPoint) {
    const pixel = GeohashUtils.latLonToPixel(
      polygonState.snapPoint.lat,
      polygonState.snapPoint.lon
    );
    
    ctx.save();
    ctx.fillStyle = 'rgba(255, 193, 7, 0.5)';
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#FFC107';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Atualiza coordenadas snap na UI
 */
function updateSnapCoords(lat, lon) {
  const snapCoords = document.getElementById('snap-coords');
  const snapLat = document.getElementById('snap-lat');
  const snapLon = document.getElementById('snap-lon');
  
  if (!snapCoords || !snapLat || !snapLon) return;
  
  if (lat === null || lon === null) {
    snapCoords.style.display = 'none';
  } else {
    snapCoords.style.display = 'block';
    snapLat.textContent = lat.toFixed(4);
    snapLon.textContent = lon.toFixed(4);
  }
}

/**
 * Atualiza status do teste (usa função global se existir)
 */
function updateTestStatus(message, type = 'normal') {
  if (typeof window.updateTestStatus === 'function') {
    window.updateTestStatus(message, type);
  }
}

/**
 * Adiciona entrada ao log (usa função global se existir)
 */
function addLogEntry(message, type = 'info') {
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Reseta o handler quando trocar de tab
 */
function resetProcessPolygonHandler() {
  clearPolygon();
  updateSnapCoords(null, null);
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.ProcessPolygonHandler = {
    init: initProcessPolygonHandler,
    reset: resetProcessPolygonHandler,
    state: polygonState
  };
}

