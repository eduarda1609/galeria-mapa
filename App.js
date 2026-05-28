import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, 
  ScrollView, Image, Alert, ActivityIndicator, Modal 
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { inicializarBanco, salvarFoto, listarFotos, excluirFoto, editarFoto } from './src/database/databaseService';

export default function App() {
  const [abaAtual, setAbaAtual] = useState('cadastro'); 
  const [listaFotos, setListaFotos] = useState([]); 
  const [titulo, setTitulo] = useState(''); 
  const [carregando, setCarregando] = useState(false); 
  
  const [termoBusca, setTermoBusca] = useState(''); 
  const [idEditando, setIdEditando] = useState(null);
  const [novoTituloEdicao, setNovoTituloEdicao] = useState('');

  const [filtroTipo, setFiltroTipo] = useState('todos'); 
  const [dataFiltro, setDataFiltro] = useState(''); 

  const [fotoSelecionadaMapa, setFotoSelecionadaMapa] = useState(null);
  const [fotoTelaCheia, setFotoTelaCheia] = useState(null); 

  useEffect(() => {
    const prepararApp = async () => {
      await inicializarBanco(); 
      await carregarDadosDoBanco(); 
      await solicitarPermissoes();
    };
    prepararApp();
  }, []);

  const solicitarPermissoes = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'Precisamos de acesso ao seu GPS para que a aplicação funcione corretamente.');
    }
  };

  const carregarDadosDoBanco = async () => {
    const dados = await listarFotos();
    setListaFotos(dados);
  };

  const formatarData = (texto) => {
    let valor = texto.replace(/\D/g, '');
    if (valor.length > 2) valor = valor.replace(/^(\d{2})(\d)/, '$1/$2');
    if (valor.length > 5) valor = valor.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
    setDataFiltro(valor.substring(0, 10));
  };

  const handleBuscarPorData = () => {
    if (dataFiltro.length !== 10) {
      Alert.alert("Aviso", "Digite a data completa no formato DD/MM/AAAA");
      return;
    }
    setFiltroTipo('data');
  };

  const handleMostrarTodas = () => {
    setFiltroTipo('todos');
    setDataFiltro('');
    setTermoBusca('');
    setFotoSelecionadaMapa(null);
  };

  const handleAdicionarItem = async () => {
    if (!titulo.trim()) {
      Alert.alert("Aviso", "Digite um título antes de capturar a foto!");
      return;
    }
    setCarregando(true);

    try {
      const permissaoCamera = await ImagePicker.requestCameraPermissionsAsync();
      const permissaoGaleria = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissaoCamera.granted || !permissaoGaleria.granted) {
        Alert.alert("Aviso", "Precisamos de acesso à câmera e galeria.");
        setCarregando(false);
        return;
      }

      Alert.alert(
        "Origem da Imagem",
        "Escolha de onde quer capturar:",
        [
          { text: "Câmera", onPress: () => executarCaptura('camera') },
          { text: "Galeria", onPress: () => executarCaptura('galeria') },
          { text: "Cancelar", style: "cancel", onPress: () => setCarregando(false) }
        ]
      );
    } catch (err) {
      setCarregando(false);
    }
  };

  const executarCaptura = async (origem) => {
    try {
      let resultado;
      
      if (origem === 'camera') {
        resultado = await ImagePicker.launchCameraAsync({ 
          quality: 0.2, 
          allowsEditing: false, 
        });
      } else {
        resultado = await ImagePicker.launchImageLibraryAsync({ 
          quality: 0.5 
        });
      }

      if (resultado.canceled || !resultado.assets) {
        setCarregando(false);
        return;
      }

      const permissaoLocalizacao = await Location.getForegroundPermissionsAsync();
      if (!permissaoLocalizacao.granted) {
        Alert.alert("Aviso", "Precisamos do GPS para salvar a coordenada. Por favor, permita o acesso nas configurações.");
        setCarregando(false);
        return;
      }

      const gps = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      
      await salvarFoto(titulo, resultado.assets[0].uri, gps.coords.latitude, gps.coords.longitude);
      
      setTitulo('');
      Alert.alert("Sucesso", "Imagem salva com sucesso!");
      await carregarDadosDoBanco();
      
      handleMostrarTodas();
      setAbaAtual('galeria'); 
    } finally {
      setCarregando(false);
    }
  };
  
  const handleExcluirItem = (id) => {
    Alert.alert("Excluir", "Apagar esta imagem permanentemente?", [
      { text: "Não", style: "cancel" },
      { text: "Sim", style: "destructive", onPress: async () => { 
        await excluirFoto(id); 
        setFotoSelecionadaMapa(null); 
        await carregarDadosDoBanco(); 
      }}
    ]);
  };

  const handleSalvarEdicao = async (id) => {
    if (!novoTituloEdicao.trim()) return;
    await editarFoto(id, novoTituloEdicao);
    setIdEditando(null);
    setNovoTituloEdicao('');
    await carregarDadosDoBanco();
  };

  const fotosFiltradas = listaFotos.filter(foto => {
    const passaBuscaTexto = foto.title.toLowerCase().includes(termoBusca.toLowerCase());
    if (!passaBuscaTexto) return false;
    if (filtroTipo === 'data') return foto.created_at.includes(dataFiltro);
    return true; 
  });

  const filtrosAtivos = filtroTipo !== 'todos' || termoBusca !== '';

  // === NOVA LÓGICA DE AGRUPAMENTO DE FOTOS PARA O MAPA ===
  // Pega as fotos filtradas e junta as que possuem a mesma coordenada
  const fotosAgrupadasMapa = Object.values(fotosFiltradas.reduce((acumulador, foto) => {
    const chaveLocal = `${foto.latitude.toFixed(4)},${foto.longitude.toFixed(4)}`;
    if (!acumulador[chaveLocal]) {
      acumulador[chaveLocal] = {
        id: chaveLocal,
        latitude: foto.latitude,
        longitude: foto.longitude,
        fotos: [] // Cria uma gaveta de fotos para este local exato
      };
    }
    acumulador[chaveLocal].fotos.push(foto); // Guarda a foto na gaveta certa
    return acumulador;
  }, {}));

  return (
    <View style={styles.container}>
      
      {/*TELA 1: CADASTRO DE IMAGEM*/}
          
      {abaAtual === 'cadastro' && (
        <View style={styles.conteudoCentralizado}>
          
          <Text style={styles.tituloTela}>Registrar Imagem</Text>
          <Text style={styles.subtituloTela}>Informe o título e capture a foto para salvar a localização</Text>
          
          
          <View style={styles.cardFormulario}>
            <Text style={styles.labelInput}>Título da Imagem:</Text>
           
            <TextInput style={styles.inputGrande} placeholder="Digite o título..." value={titulo} onChangeText={setTitulo} />
            
          
            <TouchableOpacity style={styles.botaoAdicionar} onPress={handleAdicionarItem} disabled={carregando}>
              {carregando ? <ActivityIndicator color="#fff" size="large" /> : <Text style={styles.textoBotao}>Adicionar Imagem</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/*TELA 2: GALERIA*/}
      {abaAtual === 'galeria' && (
        <ScrollView style={styles.conteudo}>
          
          {/*FILTROS*/}
          {listaFotos.length > 0 && (
            <View style={styles.cardFiltros}>
              <Text style={styles.tituloFiltro}>Explorar Galeria</Text>
              
              {/*Filtro por título*/}
              <TextInput 
                style={styles.inputBusca} 
                placeholder="🔍 Buscar por título..." 
                value={termoBusca} 
                onChangeText={setTermoBusca} 
              />
              
              {/*Filtro por Data*/}
              <View style={styles.rowFiltroData}>
                <TextInput 
                  style={styles.inputDataFiltro} 
                  placeholder="📅 Buscar por data..." 
                  value={dataFiltro} 
                  onChangeText={formatarData} 
                  keyboardType="numeric" 
                  maxLength={10} 
                />
                <TouchableOpacity style={styles.botaoBuscarData} onPress={handleBuscarPorData}>
                  <Text style={styles.textoBotaoBuscar}>Filtrar</Text>
                </TouchableOpacity>
              </View>

              {/*Botão de Limpar Filtros/Mostrar Todas*/}
              <TouchableOpacity 
                style={[styles.botaoFiltro, filtrosAtivos ? styles.botaoFiltroLimpar : styles.botaoFiltroAtivo]} 
                onPress={handleMostrarTodas}
              >
                <Text style={styles.textoFiltroAtivo}>
                  {filtrosAtivos ? 'Limpar' : 'Buscar Todas'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.seccionTitle}>Imagens Salvas ({fotosFiltradas.length})</Text>
          
         
          {fotosFiltradas.length === 0 ? <Text style={styles.textoVazio}>Nenhuma imagem encontrada para esta busca.</Text> : (
            fotosFiltradas.map((item) => (
              <View key={item.id} style={styles.itemGaleria}>
                <TouchableOpacity onPress={() => setFotoTelaCheia(item.image_uri)}>
                  <Image source={{ uri: item.image_uri }} style={styles.miniaturaFoto} />
                </TouchableOpacity>
                
                <View style={styles.infoFotoContainer}>
                  {idEditando === item.id ? (
                    <View>
                      <TextInput style={styles.inputEdicao} value={novoTituloEdicao} onChangeText={setNovoTituloEdicao} autoFocus />
                      <TouchableOpacity style={styles.botaoSalvarEdicao} onPress={() => handleSalvarEdicao(item.id)}><Text style={styles.textoBotaoEdicao}>Salvar</Text></TouchableOpacity>
                    </View>
                  ) : <Text style={styles.tituloFoto}>{item.title}</Text>}
                  
                  <Text style={styles.dataFoto}>Data: {item.created_at}</Text>
                  <Text style={styles.coordenadasFoto}>Latitude: {item.latitude.toFixed(4)} | Longitude: {item.longitude.toFixed(4)}</Text>
                  
                  <View style={styles.botoesAcao}>
                    <TouchableOpacity style={styles.botaoEditar} onPress={() => { setIdEditando(item.id); setNovoTituloEdicao(item.title); }}><Text style={styles.textoBotaoAcao}>Editar</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.botaoDeletar} onPress={() => handleExcluirItem(item.id)}><Text style={styles.textoBotaoAcao}>Excluir</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* MODAL: EXIBIÇÃO DA FOTO EM TELA CHEIA */}
      <Modal visible={!!fotoTelaCheia} transparent={true} animationType="fade">
        <View style={styles.fundoModal}>
          <TouchableOpacity style={styles.botaoFecharModal} onPress={() => setFotoTelaCheia(null)}>
            <Text style={styles.textoFecharModal}>X Fechar</Text>
          </TouchableOpacity>
          {fotoTelaCheia && (
            <Image source={{ uri: fotoTelaCheia }} style={styles.imagemTelaCheia} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/*TELA 3: MAPA DE LOCALIZAÇÃO*/}
      {abaAtual === 'mapa' && (
        <View style={styles.mapaContainer}>
          <MapView 
            style={styles.mapa}
            toolbarEnabled={false} 
            onPress={() => setFotoSelecionadaMapa(null)}
            initialRegion={{
              latitude: fotosFiltradas.length > 0 ? fotosFiltradas[0].latitude : -23.4253,
              longitude: fotosFiltradas.length > 0 ? fotosFiltradas[0].longitude : -51.9386,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            {/* Agora desenhamos os GRUPOS de fotos no mapa, e não as fotos avulsas */}
            {fotosAgrupadasMapa.map((grupo) => (
              <Marker 
                key={grupo.id} 
                coordinate={{ latitude: grupo.latitude, longitude: grupo.longitude }}
                pinColor="#f97316" 
                onPress={() => setFotoSelecionadaMapa(grupo)} // Passa o GRUPO inteiro
              >
                <Callout>
                  <View style={styles.calloutTextOnly}>
                    <Text style={styles.calloutTitulo} numberOfLines={1}>
                      {grupo.fotos.length > 1 ? `${grupo.fotos.length} fotos aqui` : grupo.fotos[0].title}
                    </Text>
                    <Text style={styles.calloutDica}>Toque no pino 👇</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>

          {/* O CARTÃO FLUTUANTE (Modificado para exibir uma lista de fotos) */}
          {fotoSelecionadaMapa && (
            <View style={styles.cartaoFlutuanteGrupo}>
              <View style={styles.headerCartaoGrupo}>
                <Text style={styles.tituloFlutuanteGrupoPrincipal}>
                  {fotoSelecionadaMapa.fotos.length > 1 ? `${fotoSelecionadaMapa.fotos.length} fotos neste local` : '1 foto neste local'}
                </Text>
                <TouchableOpacity style={styles.botaoFecharFlutuanteGrupo} onPress={() => setFotoSelecionadaMapa(null)}>
                  <Text style={styles.textoBotaoFecharGrupo}>Fechar</Text>
                </TouchableOpacity>
              </View>

              {/* Lista rolável na horizontal com as fotos do local */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollImagensGrupo}>
                {fotoSelecionadaMapa.fotos.map((foto) => (
                  <TouchableOpacity 
                    key={foto.id} 
                    style={styles.itemGrupoMap} 
                    onPress={() => setFotoTelaCheia(foto.image_uri)} // Aproveita a função de tela cheia aqui também!
                  >
                    <Image source={{ uri: foto.image_uri }} style={styles.miniaturaFlutuanteGrupo} />
                    <Text style={styles.tituloMiniaturaGrupo} numberOfLines={1}>{foto.title}</Text>
                    <Text style={styles.dataMiniaturaGrupo}>{foto.created_at.split(',')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      <View style={styles.barraNavegacao}>
        <TouchableOpacity style={[styles.botaoAba, abaAtual === 'cadastro' && styles.botaoAbaAtiva]} onPress={() => { setAbaAtual('cadastro'); setFotoSelecionadaMapa(null); }}>
          <Text style={[styles.textoAba, abaAtual === 'cadastro' && styles.textoAbaAtiva]}>➕Adicionar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botaoAba, abaAtual === 'galeria' && styles.botaoAbaAtiva]} onPress={() => { setAbaAtual('galeria'); setFotoSelecionadaMapa(null); }}>
          <Text style={[styles.textoAba, abaAtual === 'galeria' && styles.textoAbaAtiva]}>Galeria</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botaoAba, abaAtual === 'mapa' && styles.botaoAbaAtiva]} onPress={() => setAbaAtual('mapa')}>
          <Text style={[styles.textoAba, abaAtual === 'mapa' && styles.textoAbaAtiva]}>Mapa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
 
  container: { flex: 1, backgroundColor: '#f5f3ff', paddingTop: 40 }, 
  conteudo: { flex: 1, padding: 15 },
  
  //TELA DE CADASTRO
  conteudoCentralizado: { flex: 1, padding: 20, justifyContent: 'center' }, // Mantém o formulário ao centro da tela
  tituloTela: { fontSize: 28, fontWeight: 'bold', color: '#7c3aed', textAlign: 'center', marginBottom: 10 },
  subtituloTela: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 30 },
  cardFormulario: { backgroundColor: '#ffffff', padding: 25, borderRadius: 16, elevation: 6, shadowColor: '#7c3aed', shadowOpacity: 0.15, shadowRadius: 10 }, // Bloco branco flutuante onde ficam os inputs
  labelInput: { fontSize: 16, fontWeight: 'bold', color: '#4c1d95', marginBottom: 10 },
  inputGrande: { borderWidth: 1.5, borderColor: '#d8b4fe', borderRadius: 12, padding: 18, fontSize: 18, backgroundColor: '#fcfaff', marginBottom: 25 },
  botaoAdicionar: { backgroundColor: '#f97316', padding: 18, borderRadius: 12, alignItems: 'center', elevation: 3 }, 
  textoBotao: { color: '#ffffff', fontWeight: 'bold', fontSize: 18 },

  // PAINEL DE FILTROS (TELA DE GALERIA)
  cardFiltros: { backgroundColor: '#ffffff', padding: 18, borderRadius: 16, marginBottom: 20, elevation: 3, borderWidth: 1, borderColor: '#ede9fe' }, // Bloco branco que agrupa a área de busca
  tituloFiltro: { fontSize: 18, fontWeight: 'bold', color: '#7c3aed', marginBottom: 12 },
  inputBusca: { borderWidth: 1.5, borderColor: '#d8b4fe', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#fcfaff', marginBottom: 12 }, // Input principal para digitar nomes
  rowFiltroData: { flexDirection: 'row', marginBottom: 15, gap: 10 }, // Alinha o input de data e o botão "Filtrar" na mesma linha
  inputDataFiltro: { flex: 1, borderWidth: 1.5, borderColor: '#d8b4fe', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#fcfaff', letterSpacing: 1 },
  botaoBuscarData: { backgroundColor: '#7c3aed', justifyContent: 'center', paddingHorizontal: 25, borderRadius: 12, elevation: 2 },
  textoBotaoBuscar: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  botaoFiltro: { paddingVertical: 14, borderRadius: 30, alignItems: 'center', elevation: 2 }, // Botão largo na parte inferior dos filtros
  botaoFiltroAtivo: { backgroundColor: '#7c3aed' }, // Cor padrão do botão de limpar filtros
  botaoFiltroLimpar: { backgroundColor: '#ef4444' }, // Cor de alerta quando o filtro precisa ser apagado
  textoFiltroAtivo: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  //ITENS DA GALERIA (LISTAGEM)
  seccionTitle: { fontSize: 20, fontWeight: 'bold', color: '#4c1d95', marginBottom: 15, marginLeft: 5 }, // Título "Imagens Salvas (X)"
  textoVazio: { textAlign: 'center', color: '#6b7280', fontSize: 16, marginTop: 30, fontStyle: 'italic' },
  itemGaleria: { backgroundColor: '#ffffff', borderRadius: 16, padding: 12, flexDirection: 'row', marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1 }, // Card individual para cada foto listada
  miniaturaFoto: { width: 100, height: 130, borderRadius: 10, backgroundColor: '#f3f4f6' }, // A imagem pequena do lado esquerdo da lista
  infoFotoContainer: { flex: 1, paddingLeft: 15, justifyContent: 'center' }, // Ocupa o restante da linha para as informações textuais
  tituloFoto: { fontSize: 18, fontWeight: 'bold', color: '#4c1d95', marginBottom: 4 },
  dataFoto: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  coordenadasFoto: { fontSize: 12, color: '#374151', marginBottom: 10 },
  
  // Ações de cada item na galeria (Editar e Excluir)
  botoesAcao: { flexDirection: 'row', gap: 12 }, // Deixa os botões lado a lado
  botaoEditar: { backgroundColor: '#f59e0b', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, elevation: 1 },
  botaoDeletar: { backgroundColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, elevation: 1 },
  textoBotaoAcao: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  
  inputEdicao: { borderWidth: 1.5, borderColor: '#d8b4fe', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 8 },
  botaoSalvarEdicao: { backgroundColor: '#10b981', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, alignSelf: 'flex-start' },
  textoBotaoEdicao: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // MODAL DA FOTO EM TELA CHEIA
  fundoModal: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
  botaoFecharModal: { position: 'absolute', top: 50, right: 20, zIndex: 1, backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: 10, borderRadius: 8 },
  textoFecharModal: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  imagemTelaCheia: { width: '100%', height: '80%' },

  // ESTILOS: MAPA E MARCADORES
  mapaContainer: { flex: 1 }, 
  mapa: { width: '100%', height: '100%' },

  calloutTextOnly: { width: 180, padding: 10, alignItems: 'center' },
  calloutTitulo: { fontWeight: 'bold', fontSize: 15, color: '#7c3aed', marginBottom: 6, textAlign: 'center' },
  calloutData: { fontSize: 13, color: '#4b5563', textAlign: 'center' },
  calloutDica: { fontSize: 12, color: '#f97316', marginTop: 8, fontWeight: 'bold' },

  // --- NOVO ESTILO: CARTÃO FLUTUANTE DE GRUPOS ---
  cartaoFlutuanteGrupo: { position: 'absolute', bottom: 25, left: 15, right: 15, backgroundColor: '#ffffff', borderRadius: 20, padding: 15, elevation: 25, zIndex: 9999, borderWidth: 1, borderColor: '#ede9fe' },
  headerCartaoGrupo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  tituloFlutuanteGrupoPrincipal: { fontSize: 16, fontWeight: 'bold', color: '#4c1d95' },
  botaoFecharFlutuanteGrupo: { backgroundColor: '#f97316', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  textoBotaoFecharGrupo: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  scrollImagensGrupo: { flexDirection: 'row' },
  itemGrupoMap: { marginRight: 15, alignItems: 'center', width: 90 },
  miniaturaFlutuanteGrupo: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#f3f4f6', marginBottom: 5 },
  tituloMiniaturaGrupo: { fontSize: 12, color: '#4c1d95', fontWeight: 'bold', textAlign: 'center' },
  dataMiniaturaGrupo: { fontSize: 10, color: '#6b7280', textAlign: 'center' },

  // ESTILOS: NAVEGAÇÃO INFERIOR
  barraNavegacao: { flexDirection: 'row', height: 75, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e7eb', elevation: 15 }, // Fixada no rodapé da aplicação
  botaoAba: { flex: 1, alignItems: 'center', justifyContent: 'center' }, 
  botaoAbaAtiva: { borderTopWidth: 4, borderTopColor: '#7c3aed' }, 
  textoAba: { fontSize: 15, color: '#6b7280', marginTop: 4 }, 
  textoAbaAtiva: { color: '#7c3aed', fontWeight: 'bold', fontSize: 16 }
});