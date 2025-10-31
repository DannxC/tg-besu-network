/* eslint-env browser */
/**
 * Test Handler - Gerencia os testes interativos com o GeohashConverter
 */

// Estado dos testes
const testState = {
  activeTab: 'latlon-to-geohash',
  highlightedCells: [],  // Array para armazenar células destacadas
  initialized: false,  // Flag para evitar inicialização duplicada
  processingClick: false,  // Flag para evitar cliques duplicados
  inputModeLatlonToGeohash: 'click',  // 'click' ou 'manual' para tab lat/lon → geohash
  inputModeGeohashToLatlon: 'click',  // 'click' ou 'manual' para tab geohash → lat/lon
  statusTimeout: null,  // Timeout para esconder o status
  // Estado específico para tab move-geohash
  markedGeohash: null,  // Geohash atual marcado (Z-Order index)
  markedGridX: null,  // Coordenada X do geohash marcado
  markedGridY: null   // Coordenada Y do geohash marcado
};

/**
 * Adiciona uma entrada ao log da sidebar
 * @param {string} message - Mensagem a exibir
 * @param {string} type - Tipo (info, success, error, warning)
 */
function addLogEntry(message, type = 'info') {
  const logContainer = document.getElementById('log');
  if (!logContainer) return;
  
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = message;
  
  // Adicionar no final (crescer para baixo)
  logContainer.appendChild(entry);
  
  // Limitar a 50 entradas (remover do início se necessário)
  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.firstChild);
  }
  
  // Auto-scroll para o bottom
  const logSection = document.getElementById('log-section');
  if (logSection) {
    // Usar setTimeout para garantir que o DOM foi atualizado
    // eslint-disable-next-line no-undef
    setTimeout(() => {
      logSection.scrollTop = logSection.scrollHeight;
    }, 0);
  }
}

/**
 * Atualiza o status do teste
 * @param {string} message - Mensagem a exibir
 * @param {string} type - Tipo (normal, loading, success, error)
 */
function updateTestStatus(message, type = 'normal') {
  const statusEl = document.getElementById('test-status');
  const statusText = document.getElementById('status-text');
  
  if (statusEl && statusText) {
    statusText.textContent = message;
    
    // Remover classes anteriores
    statusEl.classList.remove('loading', 'success', 'error', 'hidden');
    
    // Adicionar nova classe
    if (type !== 'normal') {
      statusEl.classList.add(type);
    }
    
    // Limpar timeout anterior se existir
    if (testState.statusTimeout) {
      // eslint-disable-next-line no-undef
      clearTimeout(testState.statusTimeout);
      testState.statusTimeout = null;
    }
    
    // Esconder automaticamente após 2 segundos (exceto para erros)
    if (type !== 'error' && type !== 'loading') {
      // eslint-disable-next-line no-undef
      testState.statusTimeout = setTimeout(() => {
        if (statusEl) {
          statusEl.classList.add('hidden');
        }
      }, 2000);
    }
  }
}

/**
 * Converte um número JavaScript para int256 com DECIMALS_FACTOR (10^18)
 * @param {number} value - Valor em graus
 * @returns {ethers.BigNumber} - Valor escalado como BigNumber
 */
function toInt256WithDecimals(value) {
  // Converter valor para string com precisão suficiente (18 casas decimais)
  // Usar toFixed para garantir precisão e depois remover o ponto decimal
  const valueStr = value.toFixed(18);
  const [intPart, decPart = ''] = valueStr.split('.');
  const decPartPadded = decPart.padEnd(18, '0').substring(0, 18); // Garantir 18 dígitos
  
  // Combinar parte inteira e decimal (sem ponto)
  const fullValueStr = intPart + decPartPadded;
  
  // Criar BigNumber diretamente (preserva sinal negativo)
  return ethers.BigNumber.from(fullValueStr);
}

/**
 * Converte bytes32 para número decimal (extrai apenas os bits relevantes para a precisão)
 * @param {string|BigNumber} bytes32Hex - Geohash em formato bytes32 (0x...)
 * @param {number} precision - Precisão usada (número de bits a extrair = 2 * precision)
 * @returns {number} - Valor decimal do geohash (Z-Order index)
 */
function bytes32ToZOrderIndex(bytes32Hex, precision) {
  let hexStr;
  
  // Converter para string hex se necessário
  if (typeof bytes32Hex === 'object') {
    if (bytes32Hex.toHexString) {
      hexStr = bytes32Hex.toHexString();
    } else if (bytes32Hex.toString) {
      hexStr = bytes32Hex.toString(16);
      if (!hexStr.startsWith('0x')) {
        hexStr = '0x' + hexStr;
      }
    } else {
      hexStr = bytes32Hex.toString();
    }
  } else {
    hexStr = bytes32Hex.toString();
  }
  
  // Remover '0x' se presente
  const hex = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
  
  // Converter para BigInt para manipulação de bits
  const fullValue = BigInt('0x' + hex);
  
  // Extrair apenas os bits relevantes: 2 * precision bits (ex: precision=4 -> 8 bits)
  // Máscara: (1 << (2 * precision)) - 1
  const mask = (BigInt(1) << BigInt(2 * precision)) - BigInt(1);
  const zOrderIndex = Number(fullValue & mask);
  
  return zOrderIndex;
}

/**
 * Testa a conversão Lat/Lon → Geohash
 * @param {number} lat - Latitude em graus
 * @param {number} lon - Longitude em graus
 * @param {number} precision - Precisão
 */
async function testLatLonToGeohash(lat, lon, precision) {
  // Converter lat/lon para int256 com DECIMALS_FACTOR (10^18) - FORA DO TRY para estar disponível no catch
  const latScaled = toInt256WithDecimals(lat);
  const lonScaled = toInt256WithDecimals(lon);
  
  try {
    updateTestStatus('⏳ Chamando contrato...', 'loading');
    
    console.log('🔍 [DEBUG] Iniciando teste...');
    console.log('🔍 [DEBUG] Parâmetros:', { lat, lon, precision });
    
    // Verificar se o módulo GeohashContract existe
    if (typeof GeohashContract === 'undefined') {
      throw new Error('GeohashContract não está disponível');
    }
    
    // Obter contrato
    const contract = GeohashContract.getContract();
    if (!contract) {
      throw new Error('Contrato não carregado. Aguarde o carregamento...');
    }
    
    // Verificar se o contrato tem o método
    if (typeof contract.latLongToZOrderGeohash !== 'function') {
      throw new Error('Método latLongToZOrderGeohash não encontrado no contrato');
    }
    
    // Chamar função do contrato (view function - não precisa de transação)
    // latLongToZOrderGeohash(int256 lat, int256 lon, uint8 precision) returns (bytes32)
    let geohashBytes32;
    try {
      geohashBytes32 = await contract.callStatic.latLongToZOrderGeohash(
        latScaled,
        lonScaled,
        precision
      );
    } catch {
      // Se callStatic falhar, tentar chamada direta
      geohashBytes32 = await contract.latLongToZOrderGeohash(
        latScaled,
        lonScaled,
        precision
      );
    }
    
    // Log EXATO do RPC: parâmetros EXATOS enviados e resposta EXATA recebida
    let geohashHexExact;
    if (typeof geohashBytes32 === 'object' && geohashBytes32.toHexString) {
      geohashHexExact = geohashBytes32.toHexString();
    } else if (typeof geohashBytes32 === 'object' && geohashBytes32.toString) {
      geohashHexExact = geohashBytes32.toString(16);
      if (!geohashHexExact.startsWith('0x')) {
        geohashHexExact = '0x' + geohashHexExact;
      }
    } else {
      geohashHexExact = geohashBytes32.toString();
    }
    
    // Log com parâmetros EXATOS (latScaled, lonScaled) e resposta EXATA (geohashBytes32)
    addLogEntry(`latLongToZOrderGeohash(${latScaled.toString()}, ${lonScaled.toString()}, ${precision}) → ${geohashHexExact}`, 'success');
    
    // Converter bytes32 para índice Z-Order (extrai apenas os bits relevantes)
    const zOrderIndex = bytes32ToZOrderIndex(geohashBytes32, precision);
    
    // Pintar a célula no grid
    const success = GeohashGrid.highlightCellByGeohash(
      zOrderIndex,
      precision,
      'rgba(255, 0, 0, 0.35)'
    );
    
    if (success) {
      testState.highlightedCells.push({ geohash: zOrderIndex, precision });
      updateTestStatus(`✅ Geohash: ${geohashHexExact} → Z-Order: ${zOrderIndex} (célula pintada)`, 'success');
    } else {
      updateTestStatus(`⚠️ Geohash: ${geohashHexExact} → Z-Order: ${zOrderIndex} (fora do grid)`, 'error');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar:', error);
    const errorMsg = error.message || error.toString();
    addLogEntry(`latLongToZOrderGeohash(${latScaled.toString()}, ${lonScaled.toString()}, ${precision}) → ERRO: ${errorMsg}`, 'error');
    updateTestStatus(`❌ Erro: ${errorMsg}`, 'error');
  }
}

/**
 * Converte lat/lon escalados (com DECIMALS_FACTOR) para graus normais
 * @param {ethers.BigNumber|string} scaledValue - Valor escalado (int256)
 * @returns {number} - Valor em graus
 */
function fromInt256WithDecimals(scaledValue) {
  // Converter para BigNumber se necessário
  let valueBN;
  if (typeof scaledValue === 'string') {
    valueBN = ethers.BigNumber.from(scaledValue);
  } else {
    valueBN = scaledValue;
  }
  
  // Dividir por 10^18 para obter graus
  const decimals = ethers.BigNumber.from('1000000000000000000'); // 10^18
  
  // Se negativo, trabalhar com valor absoluto e depois aplicar o sinal
  const isNegative = valueBN.lt(0);
  const absValue = isNegative ? valueBN.mul(-1) : valueBN;
  
  // Dividir parte inteira e decimal separadamente
  const intPart = absValue.div(decimals);
  const remainder = absValue.mod(decimals);
  
  // Converter para número JavaScript
  const intPartNum = intPart.toNumber();
  
  // Parte decimal: remainder / 10^18
  // Usar parseFloat para melhor precisão
  const remainderNum = parseFloat(remainder.toString()) / 1e18;
  
  const finalValue = intPartNum + remainderNum;
  return isNegative ? -finalValue : finalValue;
}

/**
 * Testa a conversão Geohash → Lat/Lon
 * @param {number|null} gridX - Índice X da célula do grid (null se manual)
 * @param {number|null} gridY - Índice Y da célula do grid (null se manual)
 * @param {number} precision - Precisão
 * @param {string|null} manualGeohash - Geohash manual (ex: "ff", "3d")
 */
async function testGeohashToLatLong(gridX, gridY, precision, manualGeohash = null) {
  let geohashBytes32;
  let zOrderIndex;
  
  // Se manual, converter geohash string para bytes32
  if (manualGeohash !== null) {
    // Remover "0x" se presente
    let hexStr = manualGeohash.toLowerCase().trim();
    if (hexStr.startsWith('0x')) {
      hexStr = hexStr.substring(2);
    }
    
    // Validar caracteres hex
    if (!/^[0-9a-f]+$/.test(hexStr)) {
      updateTestStatus('❌ Geohash inválido (use apenas 0-9, a-f)', 'error');
      return;
    }
    
    // Pad com zeros à esquerda para completar 64 caracteres
    geohashBytes32 = '0x' + hexStr.padStart(64, '0');
    
    // Calcular Z-Order index para pintar a célula correta
    zOrderIndex = parseInt(hexStr, 16);
  } else {
    // Modo click: calcular Z-Order index do grid clicado
    zOrderIndex = GeohashUtils.calculateZOrderIndex(gridX, gridY, precision);
    
    // Converter Z-Order index para bytes32 (geohash)
    geohashBytes32 = '0x' + zOrderIndex.toString(16).padStart(64, '0');
  }
  
  try {
    updateTestStatus('⏳ Chamando contrato...', 'loading');
    
    // Verificar se o módulo GeohashContract existe
    if (typeof GeohashContract === 'undefined') {
      throw new Error('GeohashContract não está disponível');
    }
    
    // Obter contrato
    const contract = GeohashContract.getContract();
    if (!contract) {
      throw new Error('Contrato não carregado. Aguarde o carregamento...');
    }
    
    // Verificar se o contrato tem o método
    if (typeof contract.geohashToLatLong !== 'function') {
      throw new Error('Método geohashToLatLong não encontrado no contrato');
    }
    
    // Chamar função do contrato (view function - não precisa de transação)
    // geohashToLatLong(bytes32 _geohash, uint8 precision) returns (int256 lat, int256 lon)
    const result = await contract.callStatic.geohashToLatLong(
      geohashBytes32,
      precision
    );
    
    // Resultado pode ser um array [lat, lon] ou um objeto {lat, lon}
    let latScaled, lonScaled;
    if (Array.isArray(result)) {
      latScaled = result[0];
      lonScaled = result[1];
    } else if (result.lat && result.lon) {
      latScaled = result.lat;
      lonScaled = result.lon;
    } else {
      throw new Error('Formato de resposta inesperado do contrato');
    }
    
    // Log EXATO do RPC: parâmetro EXATO (geohashBytes32) e resposta EXATA (latScaled, lonScaled)
    addLogEntry(`geohashToLatLong(${geohashBytes32}, ${precision}) → lat: ${latScaled.toString()}, lon: ${lonScaled.toString()}`, 'success');
    
    // Converter lat/lon escalados para graus normais (apenas para exibição e pintura)
    const lat = fromInt256WithDecimals(latScaled);
    const lon = fromInt256WithDecimals(lonScaled);
    
    // Converter lat/lon para posição no canvas
    const canvasPos = GeohashUtils.latLonToCanvas(lat, lon);
    
    // Encontrar qual célula do grid corresponde a essa posição
    const cellSize = GeohashUtils.getCellSize(precision);
    const gridCount = GeohashUtils.getGridCount(precision);
    
    const resultGridX = Math.floor(canvasPos.x / cellSize.width);
    const resultGridY = Math.floor(canvasPos.y / cellSize.height);
    
    // Validar se está dentro dos limites
    if (resultGridX >= 0 && resultGridX < gridCount && resultGridY >= 0 && resultGridY < gridCount) {
      // Pintar a célula no grid
      GeohashGrid.highlightCell(resultGridX, resultGridY, 'rgba(255, 0, 0, 0.35)');
      
      testState.highlightedCells.push({ gridX: resultGridX, gridY: resultGridY, precision });
      updateTestStatus(`✅ Lat: ${lat.toFixed(4)}°, Lon: ${lon.toFixed(4)}° (célula pintada)`, 'success');
    } else {
      updateTestStatus(`⚠️ Lat: ${lat.toFixed(4)}°, Lon: ${lon.toFixed(4)}° (fora do grid)`, 'error');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar:', error);
    const errorMsg = error.message || error.toString();
    addLogEntry(`geohashToLatLong(${geohashBytes32}, ${precision}) → ERRO: ${errorMsg}`, 'error');
    updateTestStatus(`❌ Erro: ${errorMsg}`, 'error');
  }
}

/**
 * Marca um geohash no grid (usado na tab move-geohash)
 * @param {number} gridX - Coordenada X do grid
 * @param {number} gridY - Coordenada Y do grid
 * @param {number} precision - Precisão
 */
function markGeohash(gridX, gridY, precision) {
  // Calcular Z-Order index
  const zOrderIndex = GeohashUtils.calculateZOrderIndex(gridX, gridY, precision);
  
  // Atualizar estado
  testState.markedGeohash = zOrderIndex;
  testState.markedGridX = gridX;
  testState.markedGridY = gridY;
  
  // Re-renderizar grid
  GeohashGrid.drawGrid(precision);
  
  // Pintar célula marcada
  GeohashGrid.highlightCell(gridX, gridY, 'rgba(255, 255, 0, 0.5)');
  
  // Atualizar display do geohash
  const geohashHex = '0x' + zOrderIndex.toString(16);
  const displayEl = document.getElementById('current-geohash-display');
  if (displayEl) {
    displayEl.textContent = geohashHex;
  }
  
  // Mostrar controles direcionais
  updateDirectionControlsVisibility();
  
  updateTestStatus(`Geohash marcado: ${geohashHex}`, 'success');
}

/**
 * Testa a função singleMoveGeohash do contrato
 * @param {string} direction - Direção ('up', 'down', 'left', 'right')
 */
async function testMoveGeohash(direction) {
  if (testState.markedGeohash === null) {
    updateTestStatus('❌ Nenhum geohash marcado', 'error');
    return;
  }
  
  const precision = window.appState ? window.appState.precision : 4;
  const geohashBytes32 = '0x' + testState.markedGeohash.toString(16).padStart(64, '0');
  
  // Mapear direção string para enum do contrato (0=Up, 1=Down, 2=Left, 3=Right)
  const directionMap = {
    'up': 0,
    'down': 1,
    'left': 2,
    'right': 3
  };
  const directionEnum = directionMap[direction];
  
  try {
    updateTestStatus('⏳ Movendo geohash...', 'loading');
    
    // Obter contrato
    if (typeof GeohashContract === 'undefined') {
      throw new Error('GeohashContract não está disponível');
    }
    
    const contract = GeohashContract.getContract();
    if (!contract) {
      throw new Error('Contrato não carregado. Aguarde o carregamento...');
    }
    
    // Verificar se o contrato tem o método
    if (typeof contract.singleMoveGeohash !== 'function') {
      throw new Error('Método singleMoveGeohash não encontrado no contrato');
    }
    
    // Chamar função do contrato via RPC
    // singleMoveGeohash(bytes32 _geohash, uint8 precision, Direction _direction) returns (bytes32)
    const result = await contract.callStatic.singleMoveGeohash(
      geohashBytes32,
      precision,
      directionEnum
    );
    
    // IMPORTANTE: Usar APENAS a resposta do RPC (result) para calcular o novo geohash
    // Não calcular localmente - sempre usar o que o contrato retornou!
    
    // Converter resultado do RPC para Z-Order index
    const resultZOrder = bytes32ToZOrderIndex(result, precision);
    
    // Converter Z-Order (da resposta do RPC) para gridX, gridY
    const gridCount = Math.pow(2, precision);
    let newGridX = 0;
    let newGridY = 0;
    
    for (let i = 0; i < precision; i++) {
      const bitX = (resultZOrder >> (2 * i)) & 1;
      const bitY = (resultZOrder >> (2 * i + 1)) & 1;
      newGridX |= (bitX << i);
      newGridY |= (bitY << i);
    }
    
    // Validar limites
    if (newGridX >= 0 && newGridX < gridCount && newGridY >= 0 && newGridY < gridCount) {
      // Log da operação com RESPOSTA EXATA do RPC
      let resultHex;
      if (typeof result === 'object' && result.toHexString) {
        resultHex = result.toHexString();
      } else if (typeof result === 'string') {
        resultHex = result;
      } else {
        resultHex = '0x' + result.toString(16);
      }
      
      addLogEntry(`singleMoveGeohash(${geohashBytes32}, ${precision}, ${direction}) → ${resultHex}`, 'success');
      
      // Marcar novo geohash usando APENAS os valores calculados da RESPOSTA do RPC
      markGeohash(newGridX, newGridY, precision);
      
      updateTestStatus(`✅ Movido para: ${resultHex} (do contrato)`, 'success');
    } else {
      updateTestStatus(`⚠️ Movimento resultaria em geohash fora do grid`, 'error');
      addLogEntry(`singleMoveGeohash(${geohashBytes32}, ${precision}, ${direction}) → Fora dos limites`, 'error');
    }
    
  } catch (error) {
    console.error('❌ Erro ao mover geohash:', error);
    const errorMsg = error.message || error.toString();
    addLogEntry(`singleMoveGeohash(${geohashBytes32}, ${precision}, ${direction}) → ERRO: ${errorMsg}`, 'error');
    updateTestStatus(`❌ Erro: ${errorMsg}`, 'error');
  }
}

/**
 * Reseta o teste atual (limpa highlights)
 */
function resetTest() {
  testState.highlightedCells = [];
  testState.markedGeohash = null;
  testState.markedGridX = null;
  testState.markedGridY = null;
  
  // Resetar estado da bounding box se não estiver na tab bounding box
  // (quando mudar de tab, resetar o estado)
  if (testState.activeTab !== 'bounding-box') {
    bboxState.points = [];
    bboxState.isDrawing = false;
    bboxState.isLocked = false;
    bboxState.snapPoint = null;
    
    const snapCoords = document.getElementById('snap-coords');
    if (snapCoords) snapCoords.style.display = 'none';
  }
  
  // Re-renderizar o grid
  GeohashGrid.drawGrid(window.appState ? window.appState.precision : 4);
  
  // Se estiver na tab bounding box e não estiver travado, desenhar polígono
  if (testState.activeTab === 'bounding-box' && !bboxState.isLocked) {
    drawBBoxPolygon();
  }
  
  // Atualizar display do geohash
  const displayEl = document.getElementById('current-geohash-display');
  if (displayEl) {
    displayEl.textContent = '-';
  }
  
  // Atualizar visibilidade dos controles
  updateDirectionControlsVisibility();
  
  updateTestStatus('Clique no grid para testar', 'normal');
  console.log('🗑️ Teste resetado');
}

/**
 * Configura event listeners para o canvas
 */
function setupCanvasInteraction() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  
  // Verificar se já foi configurado (evitar listeners duplicados)
  if (canvas.dataset.listenersSetup === 'true') {
    console.log('⚠️ [SETUP] Canvas listeners já configurados, pulando...');
    return;
  }
  
  canvas.dataset.listenersSetup = 'true';
  console.log('✅ [SETUP] Configurando listeners do canvas...');
  
  // Mouse move - atualizar coordenadas
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Elementos do visualizador de coordenadas
    const snapCoords = document.getElementById('snap-coords');
    const snapLatEl = document.getElementById('snap-lat');
    const snapLonEl = document.getElementById('snap-lon');
    
    // Se estiver na tab bounding box no modo click, calcular snap específico
    if (testState.activeTab === 'bounding-box' && bboxState.inputMode === 'click' && bboxState.isDrawing && !bboxState.isLocked) {
      const precision = window.appState ? window.appState.precision : 4;
      bboxState.snapPoint = calculateSnapToEdge(x, y, precision);

      // Atualizar display do snap (não do mouse)
      if (snapLatEl) snapLatEl.textContent = bboxState.snapPoint.lat.toFixed(4) + '°';
      if (snapLonEl) snapLonEl.textContent = bboxState.snapPoint.lon.toFixed(4) + '°';
      if (snapCoords) snapCoords.style.display = 'block';

      // Re-desenhar (grid + polígono + preview line + snap dot)
      const precisionDraw = window.appState ? window.appState.precision : 4;
      GeohashGrid.drawGrid(precisionDraw);
      drawBBoxPolygon();

      // Desenhar linha de preview do último ponto até o mouse
      if (bboxState.points.length > 0) {
        drawBBoxPreviewLine(x, y);
      }

      drawSnapDot();
    } 
    // Para tabs que usam snap (latlon-to-geohash, geohash-to-latlon, move-geohash)
    else if (testState.activeTab === 'latlon-to-geohash' || 
             testState.activeTab === 'geohash-to-latlon' || 
             testState.activeTab === 'move-geohash') {
      const precision = window.appState ? window.appState.precision : 4;
      // Calcular snap genérico
      snapState.currentPoint = calculateSnapToEdgeGeneric(x, y, precision);
      
      // Atualizar display com coordenadas do snap (não do mouse)
      if (snapLatEl) snapLatEl.textContent = snapState.currentPoint.lat.toFixed(4) + '°';
      if (snapLonEl) snapLonEl.textContent = snapState.currentPoint.lon.toFixed(4) + '°';
      if (snapCoords) snapCoords.style.display = 'block';
      
      // Re-desenhar (grid + bolinha vermelha com snap)
      const precisionDraw = window.appState ? window.appState.precision : 4;
      GeohashGrid.drawGrid(precisionDraw);

      // Redesenhar células marcadas se necessário (sempre, independentemente do movimento do mouse)
      if (testState.activeTab === 'latlon-to-geohash' && testState.highlightedCells.length > 0) {
        testState.highlightedCells.forEach(cell => {
          GeohashGrid.highlightCellByGeohash(cell.geohash, precisionDraw, 'rgba(255, 0, 0, 0.5)');
        });
      } else if (testState.activeTab === 'geohash-to-latlon' && testState.highlightedCells.length > 0) {
        testState.highlightedCells.forEach(cell => {
          GeohashGrid.highlightCell(cell.gridX, cell.gridY, 'rgba(255, 0, 0, 0.5)');
        });
        } else if (testState.activeTab === 'move-geohash' && testState.markedGeohash) {
          GeohashGrid.highlightCellByGeohash(testState.markedGeohash, precisionDraw, 'rgba(255, 255, 0, 0.7)');
        }

      drawSnapDot();
    } else {
      // Tab bounding box em modo manual ou travado - esconder snap coords
      if (snapCoords) snapCoords.style.display = 'none';
      snapState.currentPoint = null;
    }
  });
  
  // Mouse leave - limpar coordenadas
  canvas.addEventListener('mouseleave', () => {
    const snapLatEl = document.getElementById('snap-lat');
    const snapLonEl = document.getElementById('snap-lon');
    
    if (snapLatEl) snapLatEl.textContent = '-';
    if (snapLonEl) snapLonEl.textContent = '-';
    
    // Limpar snap state
    snapState.currentPoint = null;
    
    // Re-desenhar sem snap dot se estiver na tab bounding box
    if (testState.activeTab === 'bounding-box' && bboxState.inputMode === 'click' && !bboxState.isLocked) {
      bboxState.snapPoint = null;
      const precision = window.appState ? window.appState.precision : 4;
      GeohashGrid.drawGrid(precision);
      drawBBoxPolygon();
    } else if (testState.activeTab === 'latlon-to-geohash' || 
               testState.activeTab === 'geohash-to-latlon' || 
               testState.activeTab === 'move-geohash') {
      // Re-desenhar sem snap dot para outras tabs
      const precision = window.appState ? window.appState.precision : 4;
      GeohashGrid.drawGrid(precision);
      // Redesenhar células marcadas se necessário
      if (testState.activeTab === 'latlon-to-geohash' && testState.highlightedCells.length > 0) {
        testState.highlightedCells.forEach(cell => {
          GeohashGrid.highlightCellByGeohash(cell.geohash, precision, 'rgba(255, 0, 0, 0.5)');
        });
      } else if (testState.activeTab === 'geohash-to-latlon' && testState.highlightedCells.length > 0) {
        testState.highlightedCells.forEach(cell => {
          GeohashGrid.highlightCell(cell.gridX, cell.gridY, 'rgba(255, 0, 0, 0.5)');
        });
        } else if (testState.activeTab === 'move-geohash' && testState.markedGeohash) {
          GeohashGrid.highlightCellByGeohash(testState.markedGeohash, precision, 'rgba(255, 255, 0, 0.7)');
        }
    }
  });
  
  // Click - executar teste (apenas se não estiver no modo manual)
  canvas.addEventListener('click', async (e) => {
    // Se estiver no modo manual, não processar clique
    if (testState.activeTab === 'latlon-to-geohash' && testState.inputModeLatlonToGeohash === 'manual') {
      return;
    }
    if (testState.activeTab === 'geohash-to-latlon' && testState.inputModeGeohashToLatlon === 'manual') {
      return;
    }
    
    // Prevenir clique duplicado
    if (testState.processingClick) {
      console.log('⚠️ [CLICK] Clique ignorado (já processando...)');
      return;
    }
    
    testState.processingClick = true;
    console.log('🖱️ [CLICK] Clique detectado no canvas');
    
    try {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Obter precision atual
      const precision = window.appState ? window.appState.precision : 4;
      
      // Determinar qual teste executar baseado na tab ativa
      if (testState.activeTab === 'latlon-to-geohash') {
        // Tab 1: Lat/Lon → Geohash
        // Usar snap se disponível
        const point = snapState.currentPoint || GeohashUtils.canvasToLatLon(x, y);
        await testLatLonToGeohash(point.lat, point.lon, precision);
      } else if (testState.activeTab === 'geohash-to-latlon') {
        // Tab 2: Geohash → Lat/Lon
        // Usar snap se disponível
        const point = snapState.currentPoint || GeohashUtils.canvasToLatLon(x, y);
        const cellSize = GeohashUtils.getCellSize(precision);

        // Calcular gridX e gridY normalmente
        let gridX = Math.floor(point.canvasX / cellSize.width);
        let gridY = Math.floor(point.canvasY / cellSize.height);

        // Verificar se a bolinha vermelha está exatamente numa linha do grid
        const isOnHorizontalEdge = (point.canvasY % cellSize.height) === 0; // Exatamente numa linha horizontal
        const isOnVerticalEdge = (point.canvasX % cellSize.width) === 0; // Exatamente numa linha vertical

        // Para arestas horizontais, priorizar célula SUPERIOR (de cima)
        if (isOnHorizontalEdge) {
          gridY = Math.max(gridY - 1, 0);
        }

        // Para arestas verticais, priorizar célula DIREITA
        if (isOnVerticalEdge) {
          gridX = Math.min(gridX, Math.pow(2, precision) - 1);
        }

        await testGeohashToLatLong(gridX, gridY, precision);
      } else if (testState.activeTab === 'move-geohash') {
        // Tab 3: Move Geohash
        // Usar snap se disponível
        const point = snapState.currentPoint || GeohashUtils.canvasToLatLon(x, y);
        const cellSize = GeohashUtils.getCellSize(precision);

        // Calcular gridX e gridY normalmente
        let gridX = Math.floor(point.canvasX / cellSize.width);
        let gridY = Math.floor(point.canvasY / cellSize.height);

        // Verificar se a bolinha vermelha está exatamente numa linha do grid
        const isOnHorizontalEdge = (point.canvasY % cellSize.height) === 0; // Exatamente numa linha horizontal
        const isOnVerticalEdge = (point.canvasX % cellSize.width) === 0; // Exatamente numa linha vertical

        // Para arestas horizontais, priorizar célula SUPERIOR (de cima)
        if (isOnHorizontalEdge) {
          gridY = Math.max(gridY - 1, 0);
        }

        // Para arestas verticais, priorizar célula DIREITA
        if (isOnVerticalEdge) {
          gridX = Math.min(gridX, Math.pow(2, precision) - 1);
        }
        
        const gridCount = Math.pow(2, precision);
        
        if (gridX >= 0 && gridX < gridCount && gridY >= 0 && gridY < gridCount) {
          markGeohash(gridX, gridY, precision);
        }
      } else if (testState.activeTab === 'bounding-box') {
        // Tab 4: Bounding Box
        if (bboxState.inputMode === 'click' && bboxState.isDrawing && bboxState.snapPoint && !bboxState.isLocked) {
          // Usar ponto com snap
          addBBoxPointFromClick(
            bboxState.snapPoint.lat,
            bboxState.snapPoint.lon,
            bboxState.snapPoint.canvasX,
            bboxState.snapPoint.canvasY
          );
        }
      }
    } finally {
      // Liberar flag após um pequeno delay para evitar cliques muito rápidos
      // eslint-disable-next-line no-undef
      setTimeout(() => {
        testState.processingClick = false;
      }, 500);
    }
  });
}

/**
 * Configura event listeners para botões de teste
 */
function setupTestButtons() {
  // Botão de reset
  const resetBtn = document.getElementById('reset-test-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetTest);
  }
  
  // Tabs (preparado para futuras tabs)
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      
      // Atualizar estado
      testState.activeTab = tab;
      
      // Atualizar UI
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Mostrar/ocultar controles de input baseado na tab
      updateInputControlsVisibility();
      
      // Reset teste
      resetTest();
    });
  });
  
  // Seletor de modo de input para Lat/Lon → Geohash
  const modeSelectLatlon = document.getElementById('input-mode-select-latlon');
  if (modeSelectLatlon) {
    modeSelectLatlon.addEventListener('change', (e) => {
      testState.inputModeLatlonToGeohash = e.target.value;
      updateInputControlsVisibility();
    });
  }
  
  // Formulário de input manual para Lat/Lon → Geohash
  const manualLatInput = document.getElementById('manual-lat');
  const manualLonInput = document.getElementById('manual-lon');
  const manualSubmitBtnLatlon = document.getElementById('manual-submit-btn-latlon');
  
  if (manualSubmitBtnLatlon) {
    manualSubmitBtnLatlon.addEventListener('click', async () => {
      const lat = parseFloat(manualLatInput.value);
      const lon = parseFloat(manualLonInput.value);
      
      // Validar valores
      if (isNaN(lat) || isNaN(lon)) {
        updateTestStatus('❌ Por favor, insira valores válidos para Lat e Lon', 'error');
        return;
      }
      
      if (lat < -90 || lat > 90) {
        updateTestStatus('❌ Latitude deve estar entre -90 e 90', 'error');
        return;
      }
      
      if (lon < -180 || lon > 180) {
        updateTestStatus('❌ Longitude deve estar entre -180 e 180', 'error');
        return;
      }
      
      // Executar teste
      const precision = window.appState ? window.appState.precision : 4;
      await testLatLonToGeohash(lat, lon, precision);
    });
  }
  
  // Permitir Enter no formulário manual de Lat/Lon
  if (manualLatInput && manualLonInput) {
    const submitOnEnter = (e) => {
      if (e.key === 'Enter') {
        manualSubmitBtnLatlon.click();
      }
    };
    manualLatInput.addEventListener('keypress', submitOnEnter);
    manualLonInput.addEventListener('keypress', submitOnEnter);
  }
  
  // Seletor de modo de input para Geohash → Lat/Lon
  const modeSelectGeohash = document.getElementById('input-mode-select-geohash');
  if (modeSelectGeohash) {
    modeSelectGeohash.addEventListener('change', (e) => {
      testState.inputModeGeohashToLatlon = e.target.value;
      updateInputControlsVisibility();
    });
  }
  
  // Formulário de input manual para Geohash → Lat/Lon
  const manualGeohashInput = document.getElementById('manual-geohash');
  const manualSubmitBtnGeohash = document.getElementById('manual-submit-btn-geohash');
  
  if (manualSubmitBtnGeohash) {
    manualSubmitBtnGeohash.addEventListener('click', async () => {
      const geohashStr = manualGeohashInput.value.trim();
      
      // Validar valor
      if (!geohashStr) {
        updateTestStatus('❌ Por favor, insira um geohash', 'error');
        return;
      }
      
      // Executar teste (gridX e gridY null para modo manual)
      const precision = window.appState ? window.appState.precision : 4;
      await testGeohashToLatLong(null, null, precision, geohashStr);
    });
  }
  
  // Permitir Enter no formulário manual de Geohash
  if (manualGeohashInput) {
    manualGeohashInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        manualSubmitBtnGeohash.click();
      }
    });
  }
  
  // Botões direcionais para tab move-geohash
  const directionButtons = document.querySelectorAll('.direction-btn');
  directionButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const direction = btn.getAttribute('data-direction');
      await testMoveGeohash(direction);
    });
  });
}

/**
 * Atualiza a visibilidade dos controles de input baseado na tab ativa
 */
function updateInputControlsVisibility() {
  const inputControlsLatlon = document.getElementById('input-controls-latlon');
  const manualFormLatlon = document.getElementById('manual-input-form-latlon');
  const inputControlsGeohash = document.getElementById('input-controls-geohash');
  const manualFormGeohash = document.getElementById('manual-input-form-geohash');
  const snapCoords = document.getElementById('snap-coords');
  
  // Esconder todos os controles primeiro
  if (inputControlsLatlon) inputControlsLatlon.style.display = 'none';
  if (inputControlsGeohash) inputControlsGeohash.style.display = 'none';
  
  // Mostrar controles apropriados baseado na tab ativa
  if (testState.activeTab === 'latlon-to-geohash') {
    if (inputControlsLatlon) {
      inputControlsLatlon.style.display = 'flex';
    }
    // Mostrar/ocultar formulário manual baseado no modo
    if (manualFormLatlon) {
      manualFormLatlon.style.display = testState.inputModeLatlonToGeohash === 'manual' ? 'flex' : 'none';
    }
    // Mostrar snap-coords nesta tab
    if (snapCoords) snapCoords.style.display = 'block';
  } else if (testState.activeTab === 'geohash-to-latlon') {
    if (inputControlsGeohash) {
      inputControlsGeohash.style.display = 'flex';
    }
    // Mostrar/ocultar formulário manual baseado no modo
    if (manualFormGeohash) {
      manualFormGeohash.style.display = testState.inputModeGeohashToLatlon === 'manual' ? 'flex' : 'none';
    }
    // Mostrar snap-coords nesta tab
    if (snapCoords) snapCoords.style.display = 'block';
  } else if (testState.activeTab === 'move-geohash') {
    // Mostrar snap-coords nesta tab
    if (snapCoords) snapCoords.style.display = 'block';
  } else if (testState.activeTab === 'bounding-box') {
    // Snap-coords será controlado pela função updateBBoxInputMode
  } else {
    // Esconder snap-coords em outras tabs
    if (snapCoords) snapCoords.style.display = 'none';
  }
  
  // Atualizar visibilidade dos controles direcionais também
  updateDirectionControlsVisibility();
  
  // Atualizar visibilidade dos controles de bounding box também
  updateBBoxControlsVisibility();
}

/**
 * Atualiza a visibilidade dos controles direcionais
 */
function updateDirectionControlsVisibility() {
  const directionControls = document.getElementById('direction-controls');
  
  if (!directionControls) return;
  
  // Mostrar apenas se:
  // 1. Estamos na tab move-geohash
  // 2. Há um geohash marcado
  if (testState.activeTab === 'move-geohash' && testState.markedGeohash !== null) {
    directionControls.style.display = 'block';
  } else {
    directionControls.style.display = 'none';
  }
}

/**
 * Redesenha a bbox calculada (usado quando volta para a tab)
 */
function redrawCalculatedBBox() {
  if (!bboxState.calculatedBBox) return;
  
  const precision = window.appState ? window.appState.precision : 4;
  const { minLat, minLon, maxLat, maxLon, geohashes } = bboxState.calculatedBBox;
  
  // Desenhar polígono
  drawBBoxPolygon();
  
  // Desenhar bounding box (retângulo vermelho)
  GeohashGrid.drawBoundingBox(minLat, minLon, maxLat, maxLon, 'rgba(255, 0, 0, 0.8)', 3);
  
  // Pintar os 3 geohashes de canto (VERMELHO)
  geohashes.forEach((geohashBytes32) => {
    const zOrderIndex = bytes32ToZOrderIndex(geohashBytes32, precision);
    GeohashGrid.highlightCellByGeohash(zOrderIndex, precision, 'rgba(255, 0, 0, 0.6)');
  });
}

/**
 * Atualiza a visibilidade dos controles de bounding box
 */
function updateBBoxControlsVisibility() {
  const bboxControls = document.getElementById('bbox-controls');
  
  if (!bboxControls) return;
  
  // Mostrar apenas se estamos na tab bounding-box
  if (testState.activeTab === 'bounding-box') {
    bboxControls.style.display = 'block';
    
    // Se estiver travado, re-desenhar tudo
    if (bboxState.isLocked && bboxState.calculatedBBox) {
      const precision = window.appState ? window.appState.precision : 4;
      GeohashGrid.drawGrid(precision);
      redrawCalculatedBBox();
    }
    
    // Atualizar modo de input para garantir estado correto
    updateBBoxInputMode();
  } else {
    bboxControls.style.display = 'none';
  }
}

// Estado para a tab bounding box
const bboxState = {
  points: [], // Array de {lat: number, lon: number, canvasX: number, canvasY: number}
  inputMode: 'manual', // 'manual' ou 'click'
  isDrawing: false, // Se está no modo de desenhar (click)
  isLocked: false, // Se está travado após calcular bbox
  snapPoint: null, // {lat: number, lon: number, canvasX: number, canvasY: number} - ponto atual com snap
  snapThreshold: 6, // pixels de distância para fazer snap (reduzido de 10 para 6)
  calculatedBBox: null // {minLat, minLon, maxLat, maxLon, geohashes} - bbox calculada
};

// Estado global para snap (usado em todas as tabs)
const snapState = {
  currentPoint: null // {lat: number, lon: number, canvasX: number, canvasY: number} - ponto atual com snap
};

/**
 * Calcula snap para arestas do grid (função genérica para todas as tabs)
 * @param {number} mouseX - Posição X do mouse no canvas
 * @param {number} mouseY - Posição Y do mouse no canvas
 * @param {number} precision - Precisão do grid
 * @returns {{lat: number, lon: number, canvasX: number, canvasY: number}} - Ponto com snap aplicado
 */
function calculateSnapToEdgeGeneric(mouseX, mouseY, precision) {
  const { lat, lon } = GeohashUtils.canvasToLatLon(mouseX, mouseY);
  const cellSize = GeohashUtils.getCellSize(precision);
  
  // Calcular qual célula estamos
  const gridX = Math.floor(mouseX / cellSize.width);
  const gridY = Math.floor(mouseY / cellSize.height);
  
  // Posições das arestas da célula
  const leftEdge = gridX * cellSize.width;
  const rightEdge = (gridX + 1) * cellSize.width;
  const topEdge = gridY * cellSize.height;
  const bottomEdge = (gridY + 1) * cellSize.height;
  
  // Distâncias para cada aresta
  const distToLeft = Math.abs(mouseX - leftEdge);
  const distToRight = Math.abs(mouseX - rightEdge);
  const distToTop = Math.abs(mouseY - topEdge);
  const distToBottom = Math.abs(mouseY - bottomEdge);
  
  let snappedX = mouseX;
  let snappedY = mouseY;
  let snappedLat = lat;
  let snappedLon = lon;
  
  // Snap para aresta vertical mais próxima (ajusta longitude)
  if (distToLeft < bboxState.snapThreshold) {
    snappedX = leftEdge;
    const snapped = GeohashUtils.canvasToLatLon(leftEdge, mouseY);
    snappedLat = snapped.lat;
    snappedLon = snapped.lon;
  } else if (distToRight < bboxState.snapThreshold) {
    snappedX = rightEdge;
    const snapped = GeohashUtils.canvasToLatLon(rightEdge, mouseY);
    snappedLat = snapped.lat;
    snappedLon = snapped.lon;
  }
  
  // Snap para aresta horizontal mais próxima (ajusta latitude)
  if (distToTop < bboxState.snapThreshold) {
    snappedY = topEdge;
    const snapped = GeohashUtils.canvasToLatLon(snappedX, topEdge);
    snappedLat = snapped.lat;
    snappedLon = snapped.lon;
  } else if (distToBottom < bboxState.snapThreshold) {
    snappedY = bottomEdge;
    const snapped = GeohashUtils.canvasToLatLon(snappedX, bottomEdge);
    snappedLat = snapped.lat;
    snappedLon = snapped.lon;
  }
  
  return {
    lat: snappedLat,
    lon: snappedLon,
    canvasX: snappedX,
    canvasY: snappedY
  };
}

/**
 * Calcula snap para arestas do grid (versão específica para bounding box com snap no primeiro ponto)
 * @param {number} mouseX - Posição X do mouse no canvas
 * @param {number} mouseY - Posição Y do mouse no canvas
 * @param {number} precision - Precisão do grid
 * @returns {{lat: number, lon: number, canvasX: number, canvasY: number}} - Ponto com snap aplicado
 */
function calculateSnapToEdge(mouseX, mouseY, precision) {
  // Se houver pontos e estiver próximo do primeiro ponto, fazer snap nele
  if (bboxState.points.length >= 3) {
    const firstPoint = bboxState.points[0];
    const distToFirst = Math.sqrt(
      Math.pow(mouseX - firstPoint.canvasX, 2) + 
      Math.pow(mouseY - firstPoint.canvasY, 2)
    );
    
    if (distToFirst < bboxState.snapThreshold * 2) { // Um pouco mais de tolerância para o primeiro ponto
      return {
        lat: firstPoint.lat,
        lon: firstPoint.lon,
        canvasX: firstPoint.canvasX,
        canvasY: firstPoint.canvasY
      };
    }
  }
  
  // Usar função genérica para snap nas arestas
  return calculateSnapToEdgeGeneric(mouseX, mouseY, precision);
}

/**
 * Verifica se um ponto já existe na lista (evitar duplicatas)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - true se já existe
 */
function isDuplicatePoint(lat, lon) {
  const threshold = 0.0001; // Tolerância para considerar duplicado
  return bboxState.points.some(p => 
    Math.abs(p.lat - lat) < threshold && Math.abs(p.lon - lon) < threshold
  );
}

/**
 * Adiciona um ponto ao polígono via click
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} canvasX - Posição X no canvas
 * @param {number} canvasY - Posição Y no canvas
 */
function addBBoxPointFromClick(lat, lon, canvasX, canvasY) {
  // Se estiver travado, não permitir adicionar pontos
  if (bboxState.isLocked) {
    return false;
  }
  
  // Verificar se é duplicado
  if (isDuplicatePoint(lat, lon)) {
    return false;
  }
  
  // Verificar se está clicando no primeiro vértice (fechar polígono)
  if (bboxState.points.length >= 3) {
    const firstPoint = bboxState.points[0];
    const dist = Math.sqrt(
      Math.pow(canvasX - firstPoint.canvasX, 2) + 
      Math.pow(canvasY - firstPoint.canvasY, 2)
    );
    
    if (dist < 15) { // 15 pixels de tolerância
      // Fechar polígono - não adicionar ponto, mas calcular automaticamente
      bboxState.isDrawing = false;
      bboxState.isLocked = true;
      updateBBoxInputMode();
      updateTestStatus('✅ Polígono fechado! Calculando BBox...', 'success');
      
      // Calcular automaticamente
      // eslint-disable-next-line no-undef
      setTimeout(() => {
        computeBoundingBox();
      }, 500);
      
      return true;
    }
  }
  
  // Adicionar ponto
  bboxState.points.push({ lat, lon, canvasX, canvasY });
  renderBBoxPoints();
  drawBBoxPolygon();
  
  updateTestStatus(`Ponto ${bboxState.points.length} adicionado`, 'success');
  return true;
}

/**
 * Desenha linha de preview do último vértice até o mouse
 * @param {number} mouseX - Posição X do mouse
 * @param {number} mouseY - Posição Y do mouse
 */
function drawBBoxPreviewLine(mouseX, mouseY) {
  if (bboxState.points.length === 0) return;

  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const lastPoint = bboxState.points[bboxState.points.length - 1];

  // Desenhar linha pontilhada do último ponto até o mouse
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]); // Linha pontilhada
  ctx.beginPath();
  ctx.moveTo(lastPoint.canvasX, lastPoint.canvasY);
  ctx.lineTo(mouseX, mouseY);
  ctx.stroke();
  ctx.setLineDash([]); // Resetar para linha sólida
}

/**
 * Desenha o polígono (linhas entre vértices)
 */
function drawBBoxPolygon() {
  const precision = window.appState ? window.appState.precision : 4;

  // Re-renderizar grid primeiro
  GeohashGrid.drawGrid(precision);

  if (bboxState.points.length < 2) return;

  // Obter contexto do canvas
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Desenhar linhas entre vértices consecutivos
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < bboxState.points.length; i++) {
    const point = bboxState.points[i];
    if (i === 0) {
      ctx.moveTo(point.canvasX, point.canvasY);
    } else {
      ctx.lineTo(point.canvasX, point.canvasY);
    }
  }

  // Fechar polígono se estiver travado (calculado) OU se estiver desenhando e tiver 3+ pontos
  if ((bboxState.isLocked || bboxState.isDrawing) && bboxState.points.length >= 3) {
    const firstPoint = bboxState.points[0];
    ctx.lineTo(firstPoint.canvasX, firstPoint.canvasY);
  }

  ctx.stroke();
  
  // Desenhar números nos vértices
  ctx.fillStyle = 'rgba(255, 255, 0, 1)';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  bboxState.points.forEach((point, index) => {
    // Desenhar círculo no vértice
    ctx.beginPath();
    ctx.arc(point.canvasX, point.canvasY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 0, 1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Desenhar número
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillText((index + 1).toString(), point.canvasX, point.canvasY - 15);
  });
}

/**
 * Desenha a bolinha vermelha que acompanha o mouse com snap
 * Funciona em todas as tabs que precisam de snap
 */
function drawSnapDot() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Para bounding box, usar bboxState.snapPoint
  if (testState.activeTab === 'bounding-box' && bboxState.inputMode === 'click' && bboxState.snapPoint && !bboxState.isLocked) {
    // Desenhar bolinha vermelha (tamanho reduzido: raio 4 ao invés de 6)
    ctx.beginPath();
    ctx.arc(bboxState.snapPoint.canvasX, bboxState.snapPoint.canvasY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } 
  // Para outras tabs que usam snap (latlon-to-geohash, geohash-to-latlon, move-geohash)
  else if (snapState.currentPoint && 
           (testState.activeTab === 'latlon-to-geohash' || 
            testState.activeTab === 'geohash-to-latlon' || 
            testState.activeTab === 'move-geohash')) {
    // Desenhar bolinha vermelha (tamanho reduzido: raio 4 ao invés de 6)
    ctx.beginPath();
    ctx.arc(snapState.currentPoint.canvasX, snapState.currentPoint.canvasY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/**
 * Remove um ponto da lista
 */
function removeBBoxPoint(index) {
  bboxState.points.splice(index, 1);
  renderBBoxPoints();
  drawBBoxPolygon();
}

/**
 * Renderiza a lista de pontos no DOM
 */
function renderBBoxPoints() {
  const list = document.getElementById('bbox-points-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  bboxState.points.forEach((point, index) => {
    // Garantir que canvasX/canvasY existam
    if (point.canvasX === undefined || point.canvasY === undefined) {
      const canvasPos = GeohashUtils.latLonToCanvas(point.lat, point.lon);
      point.canvasX = canvasPos.x;
      point.canvasY = canvasPos.y;
    }
    
    const pointDiv = document.createElement('div');
    pointDiv.className = 'bbox-point';
    
    // Número do ponto
    const numberSpan = document.createElement('span');
    numberSpan.className = 'bbox-point-number';
    numberSpan.textContent = `${index + 1}.`;
    
    // Input lat
    const latInput = document.createElement('input');
    latInput.type = 'number';
    latInput.placeholder = 'Lat';
    latInput.step = '0.0001';
    latInput.value = point.lat;
    latInput.addEventListener('change', (e) => {
      bboxState.points[index].lat = parseFloat(e.target.value) || 0;
      // Atualizar canvasX/canvasY quando mudar manualmente
      const canvasPos = GeohashUtils.latLonToCanvas(bboxState.points[index].lat, bboxState.points[index].lon);
      bboxState.points[index].canvasX = canvasPos.x;
      bboxState.points[index].canvasY = canvasPos.y;
      drawBBoxPolygon();
    });
    
    // Input lon
    const lonInput = document.createElement('input');
    lonInput.type = 'number';
    lonInput.placeholder = 'Lon';
    lonInput.step = '0.0001';
    lonInput.value = point.lon;
    lonInput.addEventListener('change', (e) => {
      bboxState.points[index].lon = parseFloat(e.target.value) || 0;
      // Atualizar canvasX/canvasY quando mudar manualmente
      const canvasPos = GeohashUtils.latLonToCanvas(bboxState.points[index].lat, bboxState.points[index].lon);
      bboxState.points[index].canvasX = canvasPos.x;
      bboxState.points[index].canvasY = canvasPos.y;
      drawBBoxPolygon();
    });
    
    // Botão remover
    const removeBtn = document.createElement('button');
    removeBtn.className = 'bbox-point-remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => removeBBoxPoint(index));
    
    pointDiv.appendChild(numberSpan);
    pointDiv.appendChild(latInput);
    pointDiv.appendChild(lonInput);
    pointDiv.appendChild(removeBtn);
    
    list.appendChild(pointDiv);
  });
}

/**
 * Limpa todos os pontos
 */
function clearBBoxPoints() {
  bboxState.points = [];
  bboxState.isDrawing = false;
  bboxState.isLocked = false;
  bboxState.snapPoint = null;
  bboxState.calculatedBBox = null;
  renderBBoxPoints();
  
  // Re-renderizar grid
  const precision = window.appState ? window.appState.precision : 4;
  GeohashGrid.drawGrid(precision);
  
  // Esconder snap coords
  const snapCoords = document.getElementById('snap-coords');
  if (snapCoords) snapCoords.style.display = 'none';
  
  updateTestStatus('Pontos limpos', 'normal');
}

/**
 * Calcula a bounding box chamando o contrato
 */
async function computeBoundingBox() {
  if (bboxState.points.length < 3) {
    updateTestStatus('❌ São necessários pelo menos 3 pontos', 'error');
    return;
  }

  // Fechar polígono automaticamente se ainda não estiver fechado
  if (!bboxState.isLocked) {
    bboxState.isDrawing = false;
    bboxState.isLocked = true;
    updateBBoxInputMode();
  }
  
  try {
    updateTestStatus('⏳ Calculando bounding box...', 'loading');
    
    // Validar pontos
    for (let i = 0; i < bboxState.points.length; i++) {
      const { lat, lon } = bboxState.points[i];
      if (lat < -90 || lat > 90) {
        updateTestStatus(`❌ Ponto ${i + 1}: Latitude deve estar entre -90 e 90`, 'error');
        return;
      }
      if (lon < -180 || lon > 180) {
        updateTestStatus(`❌ Ponto ${i + 1}: Longitude deve estar entre -180 e 180`, 'error');
        return;
      }
    }
    
    // Obter contrato
    if (typeof GeohashContract === 'undefined') {
      throw new Error('GeohashContract não está disponível');
    }
    
    const contract = GeohashContract.getContract();
    if (!contract) {
      throw new Error('Contrato não carregado. Aguarde o carregamento...');
    }
    
    // Verificar se o contrato tem o método
    if (typeof contract.computeBoundingBox !== 'function') {
      throw new Error('Método computeBoundingBox não encontrado no contrato');
    }
    
    const precision = window.appState ? window.appState.precision : 4;
    
    // Converter pontos para int256 escalados
    const latitudes = bboxState.points.map(p => toInt256WithDecimals(p.lat));
    const longitudes = bboxState.points.map(p => toInt256WithDecimals(p.lon));
    
    // Chamar função do contrato
    const bbox = await contract.callStatic.computeBoundingBox(
      latitudes,
      longitudes,
      precision
    );
    
    // Converter resposta
    const minLat = fromInt256WithDecimals(bbox.minLat);
    const minLon = fromInt256WithDecimals(bbox.minLon);
    const maxLat = fromInt256WithDecimals(bbox.maxLat);
    const maxLon = fromInt256WithDecimals(bbox.maxLon);
    const geohashes = bbox.geohashes; // Array de bytes32
    
    // Log
    addLogEntry(`computeBoundingBox(${bboxState.points.length} pontos, precision=${precision})`, 'success');
    addLogEntry(`→ minLat: ${minLat.toFixed(4)}, minLon: ${minLon.toFixed(4)}`, 'info');
    addLogEntry(`→ maxLat: ${maxLat.toFixed(4)}, maxLon: ${maxLon.toFixed(4)}`, 'info');
    addLogEntry(`→ ${geohashes.length} geohashes de canto`, 'info');
    
    // Re-renderizar grid
    GeohashGrid.drawGrid(precision);
    
    // Desenhar polígono (mantém os pontos visíveis)
    drawBBoxPolygon();
    
    // Desenhar bounding box (retângulo vermelho)
    GeohashGrid.drawBoundingBox(minLat, minLon, maxLat, maxLon, 'rgba(255, 0, 0, 0.8)', 3);
    
    // Pintar os 3 geohashes de canto (VERMELHO)
    geohashes.forEach((geohashBytes32, index) => {
      const zOrderIndex = bytes32ToZOrderIndex(geohashBytes32, precision);
      GeohashGrid.highlightCellByGeohash(zOrderIndex, precision, 'rgba(255, 0, 0, 0.6)');
      
      const geohashHex = typeof geohashBytes32 === 'object' && geohashBytes32.toHexString
        ? geohashBytes32.toHexString()
        : geohashBytes32.toString();
      
      addLogEntry(`  Geohash canto ${index}: ${geohashHex}`, 'info');
    });
    
    // Salvar bbox calculada para poder redesenhá-la quando voltar para a tab
    bboxState.calculatedBBox = {
      minLat,
      minLon,
      maxLat,
      maxLon,
      geohashes
    };
    
    // Travar o teste após calcular
    bboxState.isLocked = true;
    bboxState.isDrawing = false;
    
    // Esconder snap coords
    const snapCoords = document.getElementById('snap-coords');
    if (snapCoords) snapCoords.style.display = 'none';
    
    updateTestStatus(`✅ BBox calculada: [${minLat.toFixed(2)}, ${minLon.toFixed(2)}] → [${maxLat.toFixed(2)}, ${maxLon.toFixed(2)}]`, 'success');
    
  } catch (error) {
    console.error('❌ Erro ao calcular bounding box:', error);
    const errorMsg = error.message || error.toString();
    addLogEntry(`computeBoundingBox() → ERRO: ${errorMsg}`, 'error');
    updateTestStatus(`❌ Erro: ${errorMsg}`, 'error');
  }
}

/**
 * Atualiza o modo de input (manual/click)
 */
function updateBBoxInputMode() {
  const modeSelect = document.getElementById('bbox-input-mode-select');
  if (!modeSelect) return;
  
  bboxState.inputMode = modeSelect.value;
  
  const pointsList = document.getElementById('bbox-points-list');
  const snapCoords = document.getElementById('snap-coords');
  
  if (bboxState.inputMode === 'click') {
    // Modo click: mostrar snap coords, esconder lista de pontos
    if (pointsList) pointsList.style.display = 'none';
    if (snapCoords) snapCoords.style.display = 'block';
    
    // Só iniciar modo de desenho se não estiver travado
    if (!bboxState.isLocked) {
      bboxState.isDrawing = true;
      bboxState.points = [];
    }
    
    const precision = window.appState ? window.appState.precision : 4;
    GeohashGrid.drawGrid(precision);
    
    if (bboxState.isLocked) {
      // Se travado, desenhar polígono e bbox
      drawBBoxPolygon();
      updateTestStatus('✅ BBox já calculada. Clique no botão 🔄 para recomeçar.', 'normal');
    } else {
      updateTestStatus('🖱️ Modo Click: Clique nos vértices do polígono. Clique no primeiro vértice novamente para fechar.', 'normal');
    }
  } else {
    // Modo manual: mostrar lista de pontos, esconder snap coords
    if (pointsList) pointsList.style.display = 'block';
    if (snapCoords) snapCoords.style.display = 'none';
    
    // Parar modo de desenho apenas se não estiver travado
    if (!bboxState.isLocked) {
      bboxState.isDrawing = false;
      bboxState.snapPoint = null;
    }
    
    // Re-renderizar
    const precision = window.appState ? window.appState.precision : 4;
    GeohashGrid.drawGrid(precision);
    drawBBoxPolygon();
    
    if (bboxState.isLocked) {
      updateTestStatus('✅ BBox já calculada. Clique no botão 🔄 para recomeçar.', 'normal');
    } else {
      updateTestStatus('⌨️ Modo Manual: Edite os valores de lat/lon nos campos.', 'normal');
    }
  }
}

/**
 * Configura event listeners para a tab bounding box
 */
function setupBBoxControls() {
  const modeSelect = document.getElementById('bbox-input-mode-select');
  const computeBtn = document.getElementById('bbox-compute');
  const clearBtn = document.getElementById('bbox-clear');
  
  if (modeSelect) {
    modeSelect.addEventListener('change', updateBBoxInputMode);
  }
  
  if (computeBtn) {
    computeBtn.addEventListener('click', computeBoundingBox);
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', clearBBoxPoints);
  }
  
  // Inicializar modo manual (padrão)
  updateBBoxInputMode();
  
  // Adicionar 3 pontos iniciais no modo manual
  if (bboxState.inputMode === 'manual') {
    bboxState.points.push({ lat: 0, lon: 0, canvasX: 0, canvasY: 0 });
    bboxState.points.push({ lat: 0, lon: 0, canvasX: 0, canvasY: 0 });
    bboxState.points.push({ lat: 0, lon: 0, canvasX: 0, canvasY: 0 });
    renderBBoxPoints();
  }
}

/**
 * Inicializa o sistema de testes
 */
function initTestHandler() {
  // Evitar inicialização duplicada
  if (testState.initialized) {
    console.log('Test Handler já inicializado, pulando...');
    return;
  }
  
  testState.initialized = true;
  setupCanvasInteraction();
  setupTestButtons();
  setupBBoxControls(); // Configurar controles de bounding box
  updateInputControlsVisibility(); // Inicializar visibilidade dos controles
  updateTestStatus('Clique no grid para testar', 'normal');
  console.log('✅ Test Handler inicializado');
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.TestHandler = {
    init: initTestHandler,
    resetTest,
    testLatLonToGeohash,
    testGeohashToLatLong
  };
  
  // Exportar estado e funções da bounding box para acesso global
  window.bboxState = bboxState;
  window.updateBBoxInputMode = updateBBoxInputMode;
}
