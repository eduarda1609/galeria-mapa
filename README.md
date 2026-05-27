Aplicativo em React Native/Expo que salva fotos atreladas à sua localização exata via GPS e exibe tudo em um mapa interativo.

## Como Executar

1. Tenha o Node.js instalado no computador e o app Expo Go no celular;
2. Abra o terminal na pasta do projeto e instale as dependências: npm install;
3. Inicie o servidor: npx expo start;
4. Escaneie o QR Code com o Expo Go (computador e celular devem estar no mesmo Wi-Fi);

## Como Utilizar o app

A navegação é feita pelos 3 botões na barra inferior:

1. Adicionar (Cadastro): Nesta tela é possível fazer o registro de novas imagens.
Passo a passo: Digite um título para a imagem e clique em "Adicionar Imagem";
Câmera ou Galeria: Escolha tirar uma foto na hora ou pegar da galeria do celular;
GPS Automático: No momento em que a foto é escolhida, o app captura sua Latitude e Longitude e salva no banco local;

2. Galeria: Nesta tela é possível gerenciar todas as imagens salvas
Listagem: Mostra a miniatura da foto, título, data do registro e as coordenadas;
Filtros e Busca: Use a barra superior para pesquisar fotos pelo nome ou digite uma data específica para filtrar. Use o botão "Limpar" para apagar o que você digitou na busca;
Editar: Permite renomear o título da foto salva;
Excluir: Apaga a foto do banco de dados permanentemente;

3. Mapa: Nesta tela é possível visualizar as localizações das imagens registradas.
Marcadores (Pinos): Cada foto cadastrada gera um pino laranja no mapa correspondente ao local exato onde foi salva.
Cartão de Detalhes: Ao tocar em um pino, um cartão flutuante aparecerá na parte inferior da tela exibindo a foto, o título e a data em que foi tirada.
Fechar: Para esconder a foto, toque no botão "Fechar Detalhes" ou clique em qualquer área vazia do mapa.