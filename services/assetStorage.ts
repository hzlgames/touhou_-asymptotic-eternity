
import { ASSET_DIRS, FILE_EXT, SAVE_EXT } from "../constants";
import { SaveData } from "../types";

export type AssetType = 'sprite' | 'portrait' | 'background';

export interface AssetResult {
    url: string;
    isLocal: boolean;
}

// Type definitions for File System Access API
interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
}
interface FileSystemFileHandle extends FileSystemHandle {
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
}
interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    close(): Promise<void>;
}
interface FileSystemDirectoryHandle extends FileSystemHandle {
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    values(): AsyncIterable<FileSystemHandle>;
}

// Global reference to the root directory handle
let rootDirHandle: FileSystemDirectoryHandle | null = null;
let assetDirs: Record<string, FileSystemDirectoryHandle> = {};

// --- HELPER FUNCTIONS ---

// Strictly sanitize IDs to be safe filenames (Alphanumeric + Underscore only)
const sanitizeId = (id: string): string => {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
};

const getFilename = (id: string) => {
    return `${sanitizeId(id)}${FILE_EXT}`;
};

/**
 * Converts a Base64 Data URL to a Blob efficiently.
 * This is more robust than fetch(dataUrl) for large strings.
 */
const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

/**
 * Prompts the user to select a folder to store game data.
 * Automatically creates the required subfolder structure.
 */
export const connectFileSystem = async (): Promise<boolean> => {
    try {
        // @ts-ignore - API might not be in TS types
        rootDirHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });

        if (!rootDirHandle) return false;

        // 1. Create/Get 'assets' folder
        const assetsHandle = await rootDirHandle.getDirectoryHandle(ASSET_DIRS.ROOT, { create: true });
        
        // 2. Create/Get subfolders
        assetDirs[ASSET_DIRS.SPRITES] = await assetsHandle.getDirectoryHandle(ASSET_DIRS.SPRITES, { create: true });
        assetDirs[ASSET_DIRS.PORTRAITS] = await assetsHandle.getDirectoryHandle(ASSET_DIRS.PORTRAITS, { create: true });
        assetDirs[ASSET_DIRS.BACKGROUNDS] = await assetsHandle.getDirectoryHandle(ASSET_DIRS.BACKGROUNDS, { create: true });
        
        // 3. Create/Get 'saves' folder
        assetDirs[ASSET_DIRS.SAVES] = await rootDirHandle.getDirectoryHandle(ASSET_DIRS.SAVES, { create: true });

        console.log("[FS] File System Connected & Structure Verified");
        return true;
    } catch (error) {
        console.error("[FS] User cancelled or FS API not supported:", error);
        return false;
    }
};

export const isFileSystemConnected = () => !!rootDirHandle;

const getDirHandleForType = (type: AssetType): FileSystemDirectoryHandle | null => {
    if (!rootDirHandle) return null;
    switch (type) {
        case 'sprite': return assetDirs[ASSET_DIRS.SPRITES];
        case 'portrait': return assetDirs[ASSET_DIRS.PORTRAITS];
        case 'background': return assetDirs[ASSET_DIRS.BACKGROUNDS];
        default: return null;
    }
};

/**
 * Attempts to load asset from the connected File System.
 */
export const loadAssetFromFS = async (id: string, type: AssetType): Promise<string | null> => {
    const dir = getDirHandleForType(type);
    if (!dir) return null;

    try {
        const filename = getFilename(id);
        const fileHandle = await dir.getFileHandle(filename); // Will throw if not found
        const file = await fileHandle.getFile();
        return URL.createObjectURL(file);
    } catch (e) {
        // File not found is expected behavior for new assets
        return null;
    }
};

/**
 * Writes a base64 string directly to the file system.
 */
export const saveAssetToFS = async (id: string, type: AssetType, dataUrl: string): Promise<boolean> => {
    const dir = getDirHandleForType(type);
    if (!dir) {
        console.warn("[FS] Cannot save asset: FS not connected or Directory not found.");
        return false;
    }

    try {
        const filename = getFilename(id);
        
        // Convert DataURL to Blob manually to avoid fetch() issues
        const blob = dataURLtoBlob(dataUrl);

        const fileHandle = await dir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        console.log(`[FS] Successfully saved: ${filename} (${(blob.size / 1024).toFixed(2)} KB)`);
        return true;
    } catch (e) {
        console.error(`[FS] Failed to write file ${id}:`, e);
        throw e; // Re-throw to handle in App.tsx
    }
};

// --- SAVE GAME SYSTEM ---

export const getSavedGames = async (): Promise<string[]> => {
    if (!assetDirs[ASSET_DIRS.SAVES]) return [];
    
    const files: string[] = [];
    try {
        for await (const entry of assetDirs[ASSET_DIRS.SAVES].values()) {
            if (entry.kind === 'file' && entry.name.endsWith(SAVE_EXT)) {
                files.push(entry.name);
            }
        }
    } catch (e) {
        console.error("Error listing saves:", e);
    }
    // Sort by name descending (timestamp usually)
    return files.sort().reverse();
};

export const saveGameData = async (data: SaveData): Promise<boolean> => {
    if (!assetDirs[ASSET_DIRS.SAVES]) {
        alert("File System not connected. Cannot save.");
        return false;
    }

    try {
        const filename = `save_${Date.now()}${SAVE_EXT}`;
        const fileHandle = await assetDirs[ASSET_DIRS.SAVES].getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        
        await writable.write(blob);
        await writable.close();
        
        console.log(`[FS] Game saved to ${filename}`);
        return true;
    } catch (e) {
        console.error("Failed to save game:", e);
        alert("Failed to save game.");
        return false;
    }
};

export const loadGameData = async (filename: string): Promise<SaveData | null> => {
    if (!assetDirs[ASSET_DIRS.SAVES]) return null;

    try {
        const fileHandle = await assetDirs[ASSET_DIRS.SAVES].getFileHandle(filename);
        const file = await fileHandle.getFile();
        const text = await file.text();
        return JSON.parse(text) as SaveData;
    } catch (e) {
        console.error("Failed to load save:", e);
        return null;
    }
};
