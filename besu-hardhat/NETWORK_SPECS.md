# 📊 Especificações da Rede Besu - Teste de Stress

## 🖥️ Hardware do Host

### CPU
- **Modelo**: Intel(R) Core(TM) i7-10875H @ 2.30GHz
- **Arquitetura**: x86_64
- **Cores Físicos**: 8
- **Threads (Logical CPUs)**: 16
- **Frequência Base**: 2.30 GHz
- **Frequência Máxima (Turbo)**: 5.10 GHz
- **Frequência Mínima**: 800 MHz
- **Cache L1d**: 256 KiB (8 instances)
- **Cache L1i**: 256 KiB (8 instances)
- **Cache L2**: 2 MiB (8 instances)
- **Cache L3**: 16 MiB (1 instance)
- **Virtualização**: VT-x
- **Tecnologias**: AVX2, AES-NI, Hyper-Threading

### Memória
- **RAM Total**: 32 GB (31.18 GiB)
- **RAM Disponível**: ~12 GB
- **Swap**: 16 GB (15 GiB)
- **Tipo**: DDR4 (velocidade não especificada no lscpu)

---

## 🔗 Configuração da Rede Blockchain

### Informações Gerais
- **Tipo**: Hyperledger Besu (Ethereum Enterprise)
- **Consenso**: QBFT (Quorum Byzantine Fault Tolerance)
- **Chain ID**: 1337
- **Network ID**: Rede privada local

### Parâmetros de Consenso QBFT
- **Block Period**: 1 segundo (tempo entre blocos)
- **Request Timeout**: 4 segundos
- **Epoch Length**: 30,000 blocos
- **Forks Habilitados**: Homestead, DAO Fork, EIP-150, EIP-155, EIP-158, Byzantium, Constantinople, ConstantinopleFix, MuirGlacier, Berlin, London, ArrowGlacier, GrayGlacier

### Parâmetros de Gas
- **Gas Price Mínimo**: 0 (transações gratuitas)
- **Zero Base Fee**: true (sem taxa base EIP-1559)
- **Gas Limit por Bloco**: 4,294,967,295 (0xFFFFFFFF - máximo uint32)
- **Target Gas Limit**: 4,294,967,295

---

## 🐳 Containers Docker - Limites de Recursos

### Validadores (4 nós)
Cada validador (validator1, validator2, validator3, validator4):
- **CPU Limite**: 2.0 cores (máximo)
- **CPU Reserva**: 0.5 cores (garantido)
- **Memória Limite**: 2 GB (máximo)
- **Memória Reserva**: 512 MB (garantido)
- **Total CPU disponível para validadores**: 8 cores (2 × 4)
- **Total Memória disponível para validadores**: 8 GB (2 × 4)

### RPC Node
- **CPU Limite**: 5.0 cores (máximo)
- **CPU Reserva**: 1.0 core (garantido)
- **Memória Limite**: 4 GB (máximo)
- **Memória Reserva**: 1 GB (garantido)
- **Porta HTTP**: 8545
- **Porta WebSocket**: 8546
- **Porta GraphQL**: 8547
- **Nota**: Mais recursos que validadores porque processa `callStatic` (cálculos pesados localmente)

### Member Nodes (3 nós com privacy)
- **member1besu, member2besu, member3besu**
- **Sem limites explícitos** (usa recursos disponíveis do host)
- **Privacy Manager**: Tessera (1 por member)

### Serviços de Monitoramento
- **Prometheus**: Coleta de métricas (porta 9090)
- **Grafana**: Visualização (porta 3000)
- **Loki**: Agregação de logs (porta 3100)
- **Promtail**: Coleta de logs

---

## 📡 Configuração RPC

### HTTP RPC
- **Habilitado**: true
- **Host**: 0.0.0.0 (aceita todas as interfaces)
- **Porta**: 8545
- **CORS Origins**: ["*"] (sem restrições)
- **APIs Disponíveis**: EEA, WEB3, ETH, NET, TRACE, DEBUG, ADMIN, TXPOOL, PRIV, PERM, QBFT

### WebSocket RPC
- **Habilitado**: true
- **Host**: 0.0.0.0
- **Porta**: 8546
- **APIs Disponíveis**: EEA, WEB3, ETH, NET, TRACE, DEBUG, ADMIN, TXPOOL, PRIV, PERM, QBFT

### GraphQL
- **Habilitado**: true
- **Host**: 0.0.0.0
- **Porta**: 8547
- **CORS Origins**: ["*"]

---

## 📈 Métricas e Monitoramento

### Métricas Besu
- **Habilitado**: true
- **Host**: 0.0.0.0
- **Porta**: 9545 (cada nó)
- **Formato**: Prometheus

### Logging
- **Nível**: INFO
- **Destino**: /tmp/besu (dentro do container)
- **Agregação**: Promtail → Loki → Grafana

---

## 🔐 Contas Pré-Financiadas (Genesis)

### Contas Principais
1. **0xfe3b557e8fb62b89f4916b721be55ceb828dbd73**
   - Balance: 90,000 ETH

2. **0x627306090abaB3A6e1400e9345bC60c78a8BEf57**
   - Balance: ~96,000 ETH

3. **0xf17f52151EbEF6C7334FAD080c5704D77216b732**
   - Balance: 90,000 ETH

4. **Outras 8 contas**
   - Balance: 1,000,000,000 ETH cada (para testes)

---

## 🧪 Configuração do Teste de Stress

### Parâmetros do Teste
- **Total de OIRs**: 10,000
- **Taxa de Requisições**: 100 reqs/min por USS (300 reqs/min total)
- **Número de USSs**: 3 (member1, member2, member3)
- **Intervalo entre Requisições**: 600ms
- **Geohash Precision**: 11

### Distribuição de Polígonos
- **70%**: 3-20 pontos por polígono (comum)
- **20%**: 20-50 pontos (médio)
- **8%**: 50-80 pontos (grande)
- **2%**: 80-100 pontos (outlier)

### Região de Teste
- **Latitude**: -35° a +5° (América do Sul)
- **Longitude**: -75° a -35° (cobrindo Brasil e adjacências)
- **Raio dos Polígonos**: 0.1° a 1.6° (~11km a 178km)

### Fases do Teste
1. **Fase 1**: Criação de 10,000 OIRs
2. **Fase 2**: Atualização de 20% das OIRs (~2,000)
3. **Fase 3**: Deleção de 10% das OIRs (~1,000)

---

## 📊 Uso Atual de Recursos (Snapshot)

### Validadores
- **validator1**: CPU: 3.42%, MEM: 376.6 MiB / 2 GiB (18.39%)
- **validator2**: CPU: 3.23%, MEM: 593.6 MiB / 2 GiB (28.99%)
- **validator3**: CPU: 3.30%, MEM: 352.4 MiB / 2 GiB (17.21%)
- **validator4**: CPU: 1.39%, MEM: 455.1 MiB / 2 GiB (22.22%)

### RPC Node
- **rpcnode**: CPU: 3.15%, MEM: 374.5 MiB

### Member Nodes
- **member1besu**: CPU: 1.06%, MEM: 357.8 MiB
- **member2besu**: CPU: 1.07%, MEM: 349.5 MiB
- **member3besu**: CPU: 1.54%, MEM: 529.0 MiB

---

## 🎯 Objetivos do Teste

1. **Medir TPS** (Transactions Per Second) sustentável
2. **Avaliar uso de CPU** dos validadores sob carga
3. **Avaliar uso de Memória** dos validadores sob carga
4. **Testar limites** de 2 CPUs e 2GB RAM por validador
5. **Verificar comportamento** com polígonos grandes (múltiplos geohashes)
6. **Monitorar latência** de transações
7. **Observar block time** sob carga
8. **Testar resiliência** da rede com milhares de OIRs

---

## 📝 Notas Importantes

- **Gas Price = 0**: Transações não têm custo, apenas limite de gas do bloco
- **Block Time = 1s**: Processamento rápido de transações
- **Limites de CPU**: Cada validador pode usar no máximo 2 cores (12.5% da CPU total do host)
- **Limites de Memória**: Cada validador pode usar no máximo 2GB (6.25% da RAM total do host)
- **Polígonos Maiores**: Esperado gerar múltiplos geohashes por OIR (mais realista)
- **Região Limitada**: Testes focados na América do Sul para coerência geográfica

---

**Data de Geração**: $(date)
**Versão do Besu**: latest (verificar com `docker inspect`)
**Versão do Hardhat**: 2.26.3
**Versão do Solidity**: 0.8.20

