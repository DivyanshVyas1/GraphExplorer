import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SpaceProvider } from './context/spaceContext';
import { WsProvider } from './context/wsContext';
import Explore from './pages/explore/Explore';
import Workspace from './pages/workspace/Workspace';
import Datasets from './pages/datasets/Datasets';
import SchemaDraft from './pages/schema_draft/SchemaDraft';
import { DraftProvider } from './context/draftContext';

function App() {
  return (
    <WsProvider>
      <SpaceProvider>
        <DraftProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Navigate to="/explore" replace />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/workspace" element={<Workspace />} />
              <Route path="/datasets" element={<Datasets />} />
              <Route path="/schema-draft" element={<SchemaDraft />} />
            </Routes>
          </Router>
        </DraftProvider>
      </SpaceProvider>
    </WsProvider>
  );
}

export default App;
