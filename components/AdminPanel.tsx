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

interface Ingredient {
  id: number;
  name: string;
  category: string;
  dosageMin: string;
  dosageMax: string;
  unit: string;
  description: string | null;
  createdAt: string;
}

interface Formula {
  id: number;
  sessionId: string;
  goalComponent: string | null;
  formatComponent: string | null;
  formulaNameComponent: string | null;
  createdAt: string;
}

type Tab = 'instructions' | 'flavors' | 'ingredients' | 'formulas';

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
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);

  const [newFlavor, setNewFlavor] = useState('');
  const [newIngredient, setNewIngredient] = useState({ name: '', category: 'Energy', dosageMin: '', dosageMax: '', unit: 'mg' });

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
      
      const [settingsRes, flavorsRes, ingredientsRes, formulasRes] = await Promise.all([
        fetch('/api/admin/settings', { headers }),
        fetch('/api/admin/flavors', { headers }),
        fetch('/api/admin/ingredients', { headers }),
        fetch('/api/admin/formulas', { headers })
      ]);

      const [settingsData, flavorsData, ingredientsData, formulasData] = await Promise.all([
        settingsRes.json(),
        flavorsRes.json(),
        ingredientsRes.json(),
        formulasRes.json()
      ]);

      if (settingsData.success) {
        const instructions = settingsData.data.find((s: Setting) => s.key === 'bot_instructions');
        if (instructions) setBotInstructions(instructions.value);
      }
      if (flavorsData.success) setFlavors(flavorsData.data);
      if (ingredientsData.success) setIngredients(ingredientsData.data);
      if (formulasData.success) setFormulas(formulasData.data);
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

  const addIngredient = async () => {
    if (!newIngredient.name.trim() || !newIngredient.dosageMin || !newIngredient.dosageMax) return;
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
        setNewIngredient({ name: '', category: 'Energy', dosageMin: '', dosageMax: '', unit: 'mg' });
      }
    } catch (error) {
      console.error('Error adding ingredient:', error);
    }
  };

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
          <div className="flex border-b border-gray-200">
            {(['instructions', 'flavors', 'ingredients', 'formulas'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium text-sm capitalize ${
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

                {activeTab === 'ingredients' && (
                  <div>
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-medium text-gray-800 mb-3">Add New Ingredient</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <input
                          type="text"
                          value={newIngredient.name}
                          onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                          placeholder="Name"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <select
                          value={newIngredient.category}
                          onChange={(e) => setNewIngredient({ ...newIngredient, category: e.target.value })}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        >
                          <option value="Energy">Energy</option>
                          <option value="Focus">Focus</option>
                          <option value="Sleep">Sleep</option>
                          <option value="Recovery">Recovery</option>
                          <option value="Hydration">Hydration</option>
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
                        <button
                          onClick={addIngredient}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Category</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Dosage Range</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ingredients.map((ing) => (
                            <tr key={ing.id} className="border-b border-gray-100">
                              <td className="py-3 px-4 font-medium text-gray-800">{ing.name}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                                  {ing.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-600">
                                {ing.dosageMin} - {ing.dosageMax} {ing.unit}
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
