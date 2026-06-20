'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/api/tasks`);
        if (response.ok) {
          const data = await response.json();
          setTasks(data);
        }
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.length > 0 ? (
            tasks.map((task: any) => (
              <div key={task.id} className="border rounded-lg p-4 shadow">
                <h2 className="font-semibold text-lg">{task.title}</h2>
                <p className="text-gray-600 text-sm mt-2">{task.description}</p>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {task.status}
                  </span>
                  <span className="text-xs text-gray-500">{task.agent || 'N/A'}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-gray-400">
              Nenhuma tarefa disponível
            </div>
          )}
        </div>
      )}
    </div>
  );
}
