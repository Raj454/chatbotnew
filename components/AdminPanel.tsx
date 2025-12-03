import { useState, useEffect } from 'react';

interface Setting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

interface Flavor {
  id: number;
  name: string;
  inStock: boolean;
  createdAt: string;
}

interface Sweetener {
  id: number;
  name: string;
  description: string | null;
  inStock: boolean;
  createdAt: string;
}

interface Ingredient {
  id: number;
  name: string;
  blend: string;
  category: string | null;
  dosageMin: string;
  dosageMax: string;
  dosageSuggested: string | null;
  unit: string;
  inStock: boolean;
  description: string | null;
  createdAt: string;
}

interface Blend {
  id: number;
  name: string;
  displayOrder: number;
}

interface Formula {
  id: number;
  sessionId: string;
  goalComponent: string | null;
  formatComponent: string | null;
  formulaNameComponent: string | null;
  createdAt: string;
}

type Tab = 'instructions' | 'sweeteners' | 'flavors' | 'blends' | 'ingredients' | 'formulas';

export function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('instructions');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [botInstructions, setBotInstructions] = useState('');
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [sweeteners, setSweeteners] = useState<Sweetener[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [blends, setBlends] = useState<Blend[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [selectedBlendFilter, setSelectedBlendFilter] = useState<string>('all');

  const [newFlavor, setNewFlavor] = useState('');
  const [newSweetener, setNewSweetener] = useState({ name: '', description: '' });
  const [newBlend, setNewBlend] = useState('');
  const [newIngredient, setNewIngredient] = useState({ name: '', blend: '', dosageMin: '', dosageMax: '', dosageSuggested: '', unit: 'mg' });

  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      verifyToken(savedToken);
    }
  }, []);

  const verifyToken = async (t: string) => {
    try {
      const res = await fetch('/api/admin/verify', {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        setToken(t);
        setIsLoggedIn(true);
        loadData(t);
      } else {
        localStorage.removeItem('adminToken');
      }
    } catch {
      localStorage.removeItem('adminToken');
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        setIsLoggedIn(true);
        localStorage.setItem('adminToken', data.token);
        loadData(data.token);
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch {
      setLoginError('Connection error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    setIsLoggedIn(false);
    setToken('');
    localStorage.removeItem('adminToken');
  };

  const loadData = async (t: string) => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${t}` };
      
      const [settingsRes, flavorsRes, sweetenersRes, ingredientsRes, formulasRes, blendsRes] = await Promise.all([
        fetch('/api/admin/settings', { headers }),
        fetch('/api/admin/flavors', { headers }),
        fetch('/api/admin/sweeteners', { headers }),
        fetch('/api/admin/ingredients', { headers }),
        fetch('/api/admin/formulas', { headers }),
        fetch('/api/admin/blends', { headers })
      ]);

      const [settingsData, flavorsData, sweetenersData, ingredientsData, formulasData, blendsData] = await Promise.all([
        settingsRes.json(),
        flavorsRes.json(),
        sweetenersRes.json(),
        ingredientsRes.json(),
        formulasRes.json(),
        blendsRes.json()
      ]);

      if (settingsData.success) {
        const instructions = settingsData.data.find((s: Setting) => s.key === 'bot_instructions');
        if (instructions) setBotInstructions(instructions.value);
      }
      if (flavorsData.success) setFlavors(flavorsData.data);
      if (sweetenersData.success) setSweeteners(sweetenersData.data);
      if (ingredientsData.success) setIngredients(ingredientsData.data);
      if (formulasData.success) setFormulas(formulasData.data);
      if (blendsData.success) {
        setBlends(blendsData.data);
        if (blendsData.data.length > 0) {
          setNewIngredient(prev => ({ ...prev, blend: blendsData.data[0].name }));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const saveBotInstructions = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/admin/settings/bot_instructions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ value: botInstructions })
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  };

  const toggleFlavorStock = async (id: number, currentStock: boolean) => {
    try {
      await fetch(`/api/admin/flavors/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ inStock: !currentStock })
      });
      setFlavors(flavors.map(f => f.id === id ? { ...f, inStock: !currentStock } : f));
    } catch (error) {
      console.error('Error toggling flavor:', error);
    }
  };

  const addFlavor = async () => {
    if (!newFlavor.trim()) return;
    try {
      const res = await fetch('/api/admin/flavors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFlavor, inStock: true })
      });
      const data = await res.json();
      if (data.success) {
        setFlavors([...flavors, data.data]);
        setNewFlavor('');
      }
    } catch (error) {
      console.error('Error adding flavor:', error);
    }
  };

  const deleteFlavor = async (id: number) => {
    if (!confirm('Delete this flavor?')) return;
    try {
      await fetch(`/api/admin/flavors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setFlavors(flavors.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting flavor:', error);
    }
  };

  const toggleSweetenerStock = async (id: number, currentStock: boolean) => {
    try {
      await fetch(`/api/admin/sweeteners/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ inStock: !currentStock })
      });
      setSweeteners(sweeteners.map(s => s.id === id ? { ...s, inStock: !currentStock } : s));
    } catch (error) {
      console.error('Error toggling sweetener:', error);
    }
  };

  const addSweetener = async () => {
    if (!newSweetener.name.trim()) return;
    try {
      const res = await fetch('/api/admin/sweeteners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newSweetener.name, description: newSweetener.description || null, inStock: true })
      });
      const data = await res.json();
      if (data.success) {
        setSweeteners([...sweeteners, data.data]);
        setNewSweetener({ name: '', description: '' });
      }
    } catch (error) {
      console.error('Error adding sweetener:', error);
    }
  };

  const deleteSweetener = async (id: number) => {
    if (!confirm('Delete this sweetener?')) return;
    try {
      await fetch(`/api/admin/sweeteners/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSweeteners(sweeteners.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting sweetener:', error);
    }
  };

  const addBlend = async () => {
    if (!newBlend.trim()) return;
    try {
      const res = await fetch('/api/admin/blends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newBlend })
      });
      const data = await res.json();
      if (data.success) {
        setBlends([...blends, data.data]);
        setNewBlend('');
      }
    } catch (error) {
      console.error('Error adding blend:', error);
    }
  };

  const deleteBlend = async (id: number, blendName: string) => {
    const ingredientsInBlend = ingredients.filter(ing => ing.blend === blendName);
    if (ingredientsInBlend.length > 0) {
      alert(`Cannot delete "${blendName}" - it has ${ingredientsInBlend.length} ingredient(s) assigned to it. Please reassign or delete those ingredients first.`);
      return;
    }
    if (!confirm(`Delete blend "${blendName}"?`)) return;
    try {
      await fetch(`/api/admin/blends/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setBlends(blends.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting blend:', error);
    }
  };

  const addIngredient = async () => {
    if (!newIngredient.name.trim() || !newIngredient.blend || !newIngredient.dosageMin || !newIngredient.dosageMax) return;
    try {
      const res = await fetch('/api/admin/ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newIngredient)
      });
      const data = await res.json();
      if (data.success) {
        setIngredients([...ingredients, data.data]);
        setNewIngredient({ name: '', blend: blends[0]?.name || '', dosageMin: '', dosageMax: '', dosageSuggested: '', unit: 'mg' });
      }
    } catch (error) {
      console.error('Error adding ingredient:', error);
    }
  };

  const toggleIngredientStock = async (id: number, currentStock: boolean) => {
    try {
      await fetch(`/api/admin/ingredients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ inStock: !currentStock })
      });
      setIngredients(ingredients.map(i => i.id === id ? { ...i, inStock: !currentStock } : i));
    } catch (error) {
      console.error('Error toggling ingredient stock:', error);
    }
  };

  const filteredIngredients = selectedBlendFilter === 'all' 
    ? ingredients 
    : ingredients.filter(ing => ing.blend === selectedBlendFilter);

  const deleteIngredient = async (id: number) => {
    if (!confirm('Delete this ingredient?')) return;
    try {
      await fetch(`/api/admin/ingredients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setIngredients(ingredients.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error deleting ingredient:', error);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Admin Panel</h1>
          <p className="text-gray-500 mb-6">Enter your admin password to continue</p>
          
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          
          {loginError && (
            <p className="text-red-500 text-sm mb-4">{loginError}</p>
          )}
          
          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Craffteine Admin</h1>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {(['instructions', 'sweeteners', 'flavors', 'blends', 'ingredients', 'formulas'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium text-sm capitalize whitespace-nowrap ${
                  activeTab === tab
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'instructions' ? 'Bot Instructions' : tab}
              </button>
            ))}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : (
              <>
                {activeTab === 'instructions' && (
                  <div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bot Personality & Behavior Instructions
                      </label>
                      <p className="text-sm text-gray-500 mb-4">
                        Edit how the AI chatbot responds to users. Changes take effect immediately.
                      </p>
                      <textarea
                        value={botInstructions}
                        onChange={(e) => setBotInstructions(e.target.value)}
                        rows={20}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <button
                      onClick={saveBotInstructions}
                      disabled={saveStatus === 'saving'}
                      className={`px-6 py-3 rounded-xl font-medium transition ${
                        saveStatus === 'saved'
                          ? 'bg-green-500 text-white'
                          : saveStatus === 'error'
                          ? 'bg-red-500 text-white'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error - Try Again' : 'Save Changes'}
                    </button>
                  </div>
                )}

                {activeTab === 'sweeteners' && (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      Manage natural sweetener options for Stick Pack formulas. Only in-stock sweeteners are shown to customers.
                    </p>
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-800 mb-2">Add New Sweetener</h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSweetener.name}
                          onChange={(e) => setNewSweetener({ ...newSweetener, name: e.target.value })}
                          placeholder="Sweetener name"
                          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <input
                          type="text"
                          value={newSweetener.description}
                          onChange={(e) => setNewSweetener({ ...newSweetener, description: e.target.value })}
                          placeholder="Description (optional)"
                          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          onClick={addSweetener}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {sweeteners.map((sweetener) => (
                        <div
                          key={sweetener.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <span className="font-medium text-gray-800">{sweetener.name}</span>
                            {sweetener.description && (
                              <p className="text-sm text-gray-500">{sweetener.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleSweetenerStock(sweetener.id, sweetener.inStock)}
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                sweetener.inStock
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {sweetener.inStock ? 'In Stock' : 'Out of Stock'}
                            </button>
                            <button
                              onClick={() => deleteSweetener(sweetener.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                      {sweeteners.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No sweeteners added yet. Add some natural sweeteners above.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'flavors' && (
                  <div>
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-800 mb-2">Add New Flavor</h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFlavor}
                          onChange={(e) => setNewFlavor(e.target.value)}
                          placeholder="Flavor name"
                          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          onClick={addFlavor}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {flavors.map((flavor) => (
                        <div
                          key={flavor.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <span className="font-medium text-gray-800">{flavor.name}</span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleFlavorStock(flavor.id, flavor.inStock)}
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                flavor.inStock
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {flavor.inStock ? 'In Stock' : 'Out of Stock'}
                            </button>
                            <button
                              onClick={() => deleteFlavor(flavor.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'blends' && (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      Manage blend categories for organizing your ingredients. The Ingredients tab dropdown uses these blends.
                    </p>
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-800 mb-2">Add New Blend</h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newBlend}
                          onChange={(e) => setNewBlend(e.target.value)}
                          placeholder="e.g., SLEEP+, RECOVERY+"
                          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          onClick={addBlend}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {blends.map((blend) => {
                        const ingredientCount = ingredients.filter(i => i.blend === blend.name).length;
                        return (
                          <div
                            key={blend.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <span className="font-medium text-gray-800">{blend.name}</span>
                              <span className="ml-3 text-sm text-gray-500">
                                ({ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <button
                              onClick={() => deleteBlend(blend.id, blend.name)}
                              className="text-red-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'ingredients' && (
                  <div>
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-medium text-gray-800 mb-3">Add New Ingredient</h3>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                        <input
                          type="text"
                          value={newIngredient.name}
                          onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                          placeholder="Name"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <select
                          value={newIngredient.blend}
                          onChange={(e) => setNewIngredient({ ...newIngredient, blend: e.target.value })}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        >
                          {blends.map(blend => (
                            <option key={blend.id} value={blend.name}>{blend.name.replace('Craffteine® ', '')}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={newIngredient.dosageMin}
                          onChange={(e) => setNewIngredient({ ...newIngredient, dosageMin: e.target.value })}
                          placeholder="Min dose"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          value={newIngredient.dosageMax}
                          onChange={(e) => setNewIngredient({ ...newIngredient, dosageMax: e.target.value })}
                          placeholder="Max dose"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <input
                          type="text"
                          value={newIngredient.unit}
                          onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                          placeholder="Unit (mg)"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <button
                          onClick={addIngredient}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="mb-4 flex items-center gap-4">
                      <label className="text-sm font-medium text-gray-600">Filter by Blend:</label>
                      <select
                        value={selectedBlendFilter}
                        onChange={(e) => setSelectedBlendFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="all">All Blends ({ingredients.length})</option>
                        {blends.map(blend => (
                          <option key={blend.id} value={blend.name}>
                            {blend.name.replace('Craffteine® ', '')} ({ingredients.filter(i => i.blend === blend.name).length})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Blend</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Dosage Range</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Stock</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredIngredients.map((ing) => (
                            <tr key={ing.id} className="border-b border-gray-100">
                              <td className="py-3 px-4 font-medium text-gray-800">{ing.name}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                  {ing.blend.replace('Craffteine® ', '')}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-600">
                                {ing.dosageMin} - {ing.dosageMax} {ing.unit}
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  onClick={() => toggleIngredientStock(ing.id, ing.inStock)}
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    ing.inStock
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {ing.inStock ? 'In Stock' : 'Out'}
                                </button>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => deleteIngredient(ing.id)}
                                  className="text-red-500 hover:text-red-700 text-sm"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'formulas' && (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      View all formulas created by customers
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Formula Name</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Goal</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Format</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Session ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formulas.map((formula) => (
                            <tr key={formula.id} className="border-b border-gray-100">
                              <td className="py-3 px-4 text-gray-600 text-sm">
                                {new Date(formula.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 font-medium text-gray-800">
                                {formula.formulaNameComponent || '-'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                                  {formula.goalComponent || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-600">
                                {formula.formatComponent || '-'}
                              </td>
                              <td className="py-3 px-4 text-gray-400 text-xs font-mono">
                                {formula.sessionId.slice(0, 8)}...
                              </td>
                            </tr>
                          ))}
                          {formulas.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-gray-500">
                                No formulas created yet
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
