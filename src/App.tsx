/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Parser from './pages/Parser';
import SavedNotes from './pages/SavedNotes';
import FluidView from './pages/FluidView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/parser" element={<Parser />} />
        <Route path="/saved" element={<SavedNotes />} />
        <Route path="/fluid" element={<FluidView />} />
      </Routes>
    </BrowserRouter>
  );
}
