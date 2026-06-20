export interface Agenda {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  destination?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agent?: string;
}

export const getAgendas = async (): Promise<Agenda[]> => {
  try {
    const response = await fetch('/api/agendas');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch agendas:', error);
  }
  return [];
};

export const formatAgendaDate = (date: string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatAgendaTime = (time?: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
};
