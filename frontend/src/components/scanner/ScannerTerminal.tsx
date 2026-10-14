'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { sound } from '@/lib/sound';
import { ScanResponse, EventItem } from '@/types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Camera,
  Keyboard,
  Clock,
  UserCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface ScannerTerminalProps {
  event: EventItem;
  onAttendanceMarked?: () => void;
}

interface ScanLogItem {
  id: string;
  status: ScanResponse['status'];
  message: string;
  studentName?: string;
  enrollmentNo?: string;
  department?: string;
  attendanceStatus?: string;
  markedAt: string;
  rawIdentifier: string;
}

export function ScannerTerminal({ event, onAttendanceMarked }: ScannerTerminalProps) {
  const [identifier, setIdentifier] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [recentLogs, setRecentLogs] = useState<ScanLogItem[]>([]);
  const [mode, setMode] = useState<'USB' | 'CAMERA' | 'IMAGE'>('USB');
  const [runningPresent, setRunningPresent] = useState(event.total_present || 0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const zxingControlsRef = useRef<any>(null);

  // Auto-focus input continuously in USB mode so operator never needs to click
  useEffect(() => {
    if (mode === 'USB') {
      inputRef.current?.focus();
    }
  }, [mode, isProcessing, scanResult]);

  // Click anywhere in window to keep input focused in USB scanner mode
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (mode === 'USB' && inputRef.current && e.target !== inputRef.current) {
        // If clicking inside another input or button, don't hijack
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'BUTTON' && tag !== 'SELECT' && tag !== 'A' && tag !== 'INPUT') {
          inputRef.current.focus();
        }
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [mode]);

  // Handle camera scanner lifecycle with Code 128 & TRY_HARDER hints
  useEffect(() => {
    let active = true;

    if (mode === 'CAMERA') {
      const startCamera = async () => {
        setCameraError(null);
        try {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');

          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13,
            BarcodeFormat.UPC_A
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);

          const codeReader = new BrowserMultiFormatReader(hints, {
            delayBetweenScanAttempts: 80,
          });

          if (!videoRef.current) return;

          let lastScan = 0;
          const controls = await codeReader.decodeFromConstraints(
            {
              video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            videoRef.current,
            (result, err) => {
              if (result && active) {
                const now = Date.now();
                if (now - lastScan > 1500) {
                  lastScan = now;
                  const text = result.getText();
                  handleScanSubmit(text, 'CAMERA');
                }
              }
            }
          );
          zxingControlsRef.current = controls;
        } catch (err: any) {
          setCameraError(err.message || 'Unable to access camera. Please allow webcam permissions in your browser.');
        }
      };

      startCamera();
    }

    return () => {
      active = false;
      if (zxingControlsRef.current) {
        zxingControlsRef.current.stop();
        zxingControlsRef.current = null;
      }
    };
  }, [mode]);

  // Handle direct barcode photo/screenshot upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE, BarcodeFormat.CODE_39]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      const imageUrl = URL.createObjectURL(file);
      const result = await reader.decodeFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl);
      if (result) {
        await handleScanSubmit(result.getText(), 'IMAGE_UPLOAD');
      }
    } catch (err: any) {
      alert('Could not decode barcode from this photo. Please ensure the barcode lines are clear, horizontal, and uncropped.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanSubmit = async (scannedCode: string, method = 'BARCODE') => {
    const cleanCode = scannedCode.trim();
    if (!cleanCode || isProcessing) return;

    setIsProcessing(true);
    setIdentifier('');

    try {
      const response: ScanResponse = await api.scanAttendance(event.id, {
        student_identifier: cleanCode,
        scan_method: method,
        device_id: 'scanner-station-01',
      });

      setScanResult(response);

      // Audio feedback & log update
      if (response.status === 'SUCCESS') {
        sound.playSuccess();
        setRunningPresent((prev) => prev + 1);
        if (onAttendanceMarked) onAttendanceMarked();
      } else if (response.status === 'DUPLICATE') {
        sound.playDuplicate();
      } else {
        sound.playError();
      }

      // Add to recent logs
      const logEntry: ScanLogItem = {
        id: Math.random().toString(36).substring(7),
        status: response.status,
        message: response.message,
        studentName: response.student?.name,
        enrollmentNo: response.student?.enrollment_no,
        department: response.student?.department,
        attendanceStatus: response.attendance_status,
        markedAt: new Date().toLocaleTimeString(),
        rawIdentifier: cleanCode,
      };
      setRecentLogs((prev) => [logEntry, ...prev.slice(0, 19)]); // Keep last 20

    } catch (err: any) {
      sound.playError();
      const errResponse: ScanResponse = {
        status: 'SERVER_ERROR',
        message: err.message || 'Server connection error while validating scan',
      };
      setScanResult(errResponse);
    } finally {
      setIsProcessing(false);
      // Re-focus input immediately
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScanSubmit(identifier, 'BARCODE');
  };

  return (
    <div className="w-full space-y-6">
      {/* Top operational running bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Present Count</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{runningPresent}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Registered</div>
            <div className="text-2xl font-bold text-white mt-1 font-mono">{event.total_registered || 0}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Scans This Session</div>
            <div className="text-2xl font-bold text-blue-400 mt-1 font-mono">{recentLogs.length}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-950/40 border border-blue-800/40 flex items-center justify-center text-blue-400">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Event Status</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${event.status === 'OPEN' ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'}`} />
              <span className="text-sm font-bold text-white font-mono">{event.status}</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode('USB')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                mode === 'USB' ? 'border-blue-500 bg-blue-600 text-white' : 'border-neutral-800 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>USB Hardware</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('CAMERA')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                mode === 'CAMERA' ? 'border-blue-500 bg-blue-600 text-white' : 'border-neutral-800 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Webcam Scanner</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('IMAGE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                mode === 'IMAGE' ? 'border-blue-500 bg-blue-600 text-white' : 'border-neutral-800 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              <span>🖼️ Upload Photo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Scanner Viewport & Visual Feedback Card */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-xl space-y-6">
        {mode === 'USB' ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                USB Barcode Scanner Input (Always Focused)
              </label>
              <span className="text-[11px] text-neutral-400">Point USB scanner at barcode and trigger</span>
            </div>

            <form onSubmit={onFormSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                spellCheck="false"
                disabled={isProcessing || event.status !== 'OPEN'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  event.status !== 'OPEN'
                    ? `Attendance locked — Event is currently ${event.status}`
                    : 'Scan barcode or type member identifier / enrollment no and press Enter...'
                }
                className="w-full h-16 rounded-xl border-2 border-neutral-700 bg-neutral-950 px-5 text-lg font-mono text-white placeholder-neutral-500 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition shadow-inner disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isProcessing || !identifier.trim() || event.status !== 'OPEN'}
                className="absolute right-3 top-3 h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition disabled:opacity-0 cursor-pointer"
              >
                {isProcessing ? 'Verifying...' : 'Submit'}
              </button>
            </form>
          </div>
        ) : mode === 'CAMERA' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                Optical Camera Scanner (Code 128 / QR)
              </span>
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Optical Sensor Active
              </span>
            </div>

            {/* Practical Tip Banner for Phone Screens */}
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-xs text-blue-200 space-y-1">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <span>📱 Scanning from a Phone Screen?</span>
              </div>
              <ul className="text-[11px] text-neutral-300 list-disc list-inside space-y-0.5">
                <li><strong>Lower phone brightness to ~50%</strong> (prevents webcam glare from washing out bars).</li>
                <li>Hold the phone steady <strong>6 to 10 inches</strong> away from your camera.</li>
                <li>Ensure the barcode is <strong>strictly horizontal</strong> across the red laser line.</li>
              </ul>
            </div>

            {cameraError ? (
              <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">
                {cameraError}
              </div>
            ) : (
              <div className="relative w-full max-w-lg mx-auto aspect-video rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-2xl">
                <video ref={videoRef} className="w-full h-full object-cover" />
                
                {/* Horizontal Red Laser Scanning Beam */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.9)] pointer-events-none animate-pulse" />
                
                <div className="absolute inset-0 border-2 border-dashed border-red-500/40 pointer-events-none rounded-xl m-4 flex flex-col justify-between p-3">
                  <div className="text-[10px] text-red-400 font-mono bg-black/70 px-2 py-0.5 rounded self-start">
                    [OPTICAL SENSOR ACTIVE]
                  </div>
                  <div className="text-[11px] text-center bg-black/80 text-neutral-200 px-3 py-1 rounded-full font-mono self-center">
                    Align horizontal barcode across the red laser line
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <span>🖼️ Upload Barcode Image or Screenshot</span>
              </span>
            </div>

            <div className="p-8 rounded-xl border-2 border-dashed border-neutral-700 bg-neutral-950/40 text-center hover:border-blue-500 transition">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isProcessing}
                className="w-full text-xs text-neutral-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-400 mt-3">
                Upload any GIF, PNG, or photo of a student barcode to decode and record attendance immediately.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Scan Result Card (Semantic Green / Amber / Red) */}
        {scanResult ? (
          <div
            className={`rounded-xl border p-5 transition-all duration-200 ${
              scanResult.status === 'SUCCESS'
                ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-100 shadow-lg shadow-emerald-950/40'
                : scanResult.status === 'DUPLICATE'
                ? 'bg-amber-950/40 border-amber-600/80 text-amber-100 shadow-lg shadow-amber-950/40'
                : 'bg-red-950/40 border-red-600/80 text-red-100 shadow-lg shadow-red-950/40'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    scanResult.status === 'SUCCESS'
                      ? 'bg-emerald-600 text-white'
                      : scanResult.status === 'DUPLICATE'
                      ? 'bg-amber-600 text-white'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  {scanResult.status === 'SUCCESS' ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : scanResult.status === 'DUPLICATE' ? (
                    <AlertTriangle className="w-7 h-7" />
                  ) : (
                    <XCircle className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold tracking-tight font-mono">
                      {scanResult.status === 'SUCCESS'
                        ? '✓ ATTENDANCE MARKED'
                        : scanResult.status === 'DUPLICATE'
                        ? '⚠️ ATTENDANCE DUPLICATE'
                        : `✕ SCAN REJECTED: ${scanResult.status}`}
                    </span>
                    {scanResult.attendance_status && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-black/40 border border-white/20">
                        {scanResult.attendance_status}
                      </span>
                    )}
                  </div>

                  <p className="text-sm mt-1 opacity-90">{scanResult.message}</p>

                  {scanResult.student && (
                    <div className="mt-3.5 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="opacity-60 text-[10px] uppercase font-semibold">Student Name</div>
                        <div className="font-bold text-white text-sm">{scanResult.student.name}</div>
                      </div>
                      <div>
                        <div className="opacity-60 text-[10px] uppercase font-semibold">Enrollment No</div>
                        <div className="font-mono font-medium text-white">{scanResult.student.enrollment_no}</div>
                      </div>
                      <div>
                        <div className="opacity-60 text-[10px] uppercase font-semibold">Department</div>
                        <div className="font-medium text-white">{scanResult.student.department}</div>
                      </div>
                      <div>
                        <div className="opacity-60 text-[10px] uppercase font-semibold">Year / Section</div>
                        <div className="font-medium text-white">{scanResult.student.year}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {scanResult.marked_at && (
                <div className="text-right text-xs opacity-75 font-mono">
                  {new Date(scanResult.marked_at).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-neutral-800 text-center text-neutral-500 text-xs flex flex-col items-center justify-center gap-1.5 py-10">
            <Sparkles className="w-5 h-5 text-neutral-600 mb-1" />
            <span className="font-medium text-neutral-400">Scanner Ready & Listening</span>
            <span>Scan student physical barcode or QR code to verify eligibility and record attendance</span>
          </div>
        )}
      </div>

      {/* Recent Scans Session Log */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Recent Scans This Session
          </h3>
          <span className="text-[11px] text-neutral-500 font-mono">
            {recentLogs.length} logged
          </span>
        </div>

        {recentLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-500">
            No scans recorded in this browser session yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-[10px] uppercase text-neutral-500 font-semibold">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Enrollment</th>
                  <th className="pb-2">Department</th>
                  <th className="pb-2">Scanned ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-800/30 transition">
                    <td className="py-2.5 text-neutral-400">{log.markedAt}</td>
                    <td className="py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : log.status === 'DUPLICATE'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                            : 'bg-red-950 text-red-400 border border-red-800/60'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 font-sans font-medium text-white">{log.studentName || '—'}</td>
                    <td className="py-2.5 text-neutral-300">{log.enrollmentNo || '—'}</td>
                    <td className="py-2.5 font-sans text-neutral-400">{log.department || '—'}</td>
                    <td className="py-2.5 text-neutral-500 truncate max-w-[120px]">{log.rawIdentifier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
