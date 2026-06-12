CREATE TABLE IF NOT EXISTS kanban_settings (
    status TEXT PRIMARY KEY,
    background_color TEXT,
    label_malgache TEXT
);

-- Données initiales par défaut
INSERT OR IGNORE INTO kanban_settings (status, background_color, label_malgache) VALUES 
('New', '#fee2e2', 'Vaovao'),
('In_Progress', '#fef3c7', 'Efa manao'),
('Closed', '#dcfce7', 'Vita');