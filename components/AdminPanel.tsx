import React, { useState, useEffect } from 'react';

interface Flavor {
  id: number;
  name: string;
  inStock: boolean;
}

interface Ingredient {
  id: number;
  name: string;
  category: string;
  dosageMin: string;
  dosageMax: string;
  unit: string;
}

export default function AdminPanel() {
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeTab, setActiveTab] = useState<'flavors' | 'ingredients'>('flavors');
  const [newFlavorName, setNewFlavorName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [flavorRes, ingredientRes] = await Promise.all([
        fetch('/api/flavors'),
        fetch('/api/ingredients')
      ]);

      if (flavorRes.ok) {
        const flavorData = await flavorRes.json();
        setFlavors(flavorData.data);
      }

      if (ingredientRes.ok) {
        const ingredientData = await ingredientRes.json();
        setIngredients(ingredientData.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const toggleFlavorStatus = async (id: number, inStock: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/flavors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inStock: !inStock })
      });

      if (res.ok) {
        setFlavors(flavors.map(f => f.id === id ? { ...f, inStock: !inStock } : f));
      }
    } catch (error) {
      console.error('Error updating flavor:', error);
    }
    setLoading(false);
  };

  const addFlavor = async () => {
    if (!newFlavorName.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/admin/flavors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFlavorName, inStock: true })
      });

      if (res.ok) {
        const data = await res.json();
        setFlavors([...flavors, data.data]);
        setNewFlavorName('');
      }
    } catch (error) {
      console.error('Error adding flavor:', error);
    }
    setLoading(false);
  };

  return (
    <div className="admin-panel" style={{ padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px', margin: '20px 0' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>📋 Admin Panel</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('flavors')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'flavors' ? '#8b5cf6' : '#ddd',
            color: activeTab === 'flavors' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Flavors
        </button>
        <button
          onClick={() => setActiveTab('ingredients')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'ingredients' ? '#8b5cf6' : '#ddd',
            color: activeTab === 'ingredients' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Ingredients
        </button>
      </div>

      {activeTab === 'flavors' && (
        <div>
          <h3>Manage Flavors</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input
              type="text"
              value={newFlavorName}
              onChange={(e) => setNewFlavorName(e.target.value)}
              placeholder="New flavor name"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <button
              onClick={addFlavor}
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Add Flavor
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#e0e0e0' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Flavor Name</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {flavors.map((flavor) => (
                <tr key={flavor.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{flavor.name}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: flavor.inStock ? '#d1fae5' : '#fee2e2',
                      color: flavor.inStock ? '#065f46' : '#991b1b'
                    }}>
                      {flavor.inStock ? '✅ In Stock' : '❌ Out of Stock'}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button
                      onClick={() => toggleFlavorStatus(flavor.id, flavor.inStock)}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: flavor.inStock ? '#ef4444' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {flavor.inStock ? 'Mark Out' : 'Mark In'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'ingredients' && (
        <div>
          <h3>Ingredients List</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#e0e0e0' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Category</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Dosage Range</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Unit</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ingredient) => (
                <tr key={ingredient.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{ingredient.name}</td>
                  <td style={{ padding: '10px' }}>{ingredient.category}</td>
                  <td style={{ padding: '10px' }}>{ingredient.dosageMin} - {ingredient.dosageMax}</td>
                  <td style={{ padding: '10px' }}>{ingredient.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
