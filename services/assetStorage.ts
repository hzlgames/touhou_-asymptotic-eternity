
import { ASSET_DIRS, FILE_EXT } from "../constants";

export type AssetType = 'sprite' | 'portrait' | 'background';

export interface AssetResult {
    url: string;
    isLocal: boolean;
}

// Type definitions for File System Access API (polyfill/fix for TS)
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
}

// Global reference to the root directory handle
let rootDirHandle: FileSystemDirectoryHandle | null = null;
let assetDirs: Record<string, FileSystemDirectoryHandle> = {};

/**
 * Prompts the user to select a folder to store game data.
 * Automatically creates the required subfolder structure.
 */
export const connectFileSystem = async (): Promise<boolean> => {
    try {
        // @ts-ignore - showDirectoryPicker is not in all TS lib definitions yet
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

        console.log("File System Connected & Structure Verified");
        return true;
    } catch (error) {
        console.error("User cancelled or FS API not supported:", error);
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

const getFilename = (id: string) => {
    return `${id.replace(/\s+/g, '_').toUpperCase()}${FILE_EXT}`;
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
        // File not found
        return null;
    }
};

/**
 * Writes a base64 string directly to the file system.
 */
export const saveAssetToFS = async (id: string, type: AssetType, dataUrl: string): Promise<boolean> => {
    const dir = getDirHandleForType(type);
    if (!dir) {
        console.warn("Cannot save asset: FS not connected or Directory not found.");
        return false;
    }

    try {
        const filename = getFilename(id);
        const fileHandle = await dir.getFileHandle(filename, { create: true });
        
        // Convert DataURL to Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        console.log(`[FS] Saved ${filename} successfully.`);
        return true;
    } catch (e) {
        console.error("Failed to write file:", e);
        throw e; // Re-throw to handle in App.tsx
    }
};

/**
 * Legacy Fallback: Download via browser anchor tag (if FS is not connected)
 */
export const downloadAssetLegacy = (dataUrl: string, id: string, type: AssetType) => {
    const filename = getFilename(id);
    const pathHint = `/${ASSET_DIRS.ROOT}/${type}s/`; // heuristic hint
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`Saved "${filename}" to Downloads.\n\nTo use this file, move it to:\n[GameFolder]${pathHint}`);
};
