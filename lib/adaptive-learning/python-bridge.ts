/**
 * Python Bridge for IEKT Inference Service
 * Handles communication between Next.js and Python inference service
 */

import { spawn, ChildProcess } from "child_process";
import path from "path";

export interface Interaction {
  qid: number;
  concept: string | number;
  correct: 0 | 1;
  timestamp: number;
}

export interface KnowledgeState {
  student_id: string;
  mastery_per_kc: Record<string, number>;
  recommended_kcs: string[];
  overall_mastery: number;
  num_interactions: number;
}

export class PythonBridge {
  private pythonPath: string;
  private modelPath: string;
  private configPath: string;
  private serviceProcess: ChildProcess | null = null;

  constructor() {
    // Paths relative to project root
    const projectRoot = process.cwd();
    this.pythonPath = path.join(
      projectRoot,
      "python-backend",
      "venv",
      "bin",
      "python"
    );
    this.modelPath = path.join(
      projectRoot,
      "python-backend",
      "models",
      "iekt_xes3g5m.pt"
    );
    this.configPath = path.join(
      projectRoot,
      "python-backend",
      "models",
      "config.json"
    );
  }

  /**
   * Call Python inference service to predict knowledge state
   */
  async predictKnowledgeState(
    studentId: string,
    interactionHistory: Interaction[]
  ): Promise<KnowledgeState> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(
        process.cwd(),
        "python-backend",
        "inference_service.py"
      );

      const input = JSON.stringify({
        student_id: studentId,
        interaction_history: interactionHistory,
      });

      const pythonProcess = spawn(this.pythonPath, [scriptPath, "--predict"], {
        cwd: path.join(process.cwd(), "python-backend"),
      });

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`Python process exited with code ${code}: ${stderr}`)
          );
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      });

      pythonProcess.stdin.write(input);
      pythonProcess.stdin.end();
    });
  }

  /**
   * Update knowledge state after a new interaction
   */
  async updateKnowledgeState(
    studentId: string,
    newInteraction: Interaction
  ): Promise<KnowledgeState> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(
        process.cwd(),
        "python-backend",
        "inference_service.py"
      );

      const input = JSON.stringify({
        student_id: studentId,
        new_interaction: newInteraction,
      });

      const pythonProcess = spawn(this.pythonPath, [scriptPath, "--update"], {
        cwd: path.join(process.cwd(), "python-backend"),
      });

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`Python process exited with code ${code}: ${stderr}`)
          );
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      });

      pythonProcess.stdin.write(input);
      pythonProcess.stdin.end();
    });
  }

  /**
   * Get mastery levels for specific knowledge components
   */
  async getMasteryLevels(
    studentId: string,
    kcList?: string[]
  ): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(
        process.cwd(),
        "python-backend",
        "inference_service.py"
      );

      const input = JSON.stringify({
        student_id: studentId,
        kc_list: kcList,
      });

      const pythonProcess = spawn(this.pythonPath, [scriptPath, "--mastery"], {
        cwd: path.join(process.cwd(), "python-backend"),
      });

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`Python process exited with code ${code}: ${stderr}`)
          );
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      });

      pythonProcess.stdin.write(input);
      pythonProcess.stdin.end();
    });
  }

  /**
   * Check if Python service is available
   */
  async checkService(): Promise<boolean> {
    try {
      // Simple health check
      const result = await this.predictKnowledgeState("test", []);
      return result !== null;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let pythonBridgeInstance: PythonBridge | null = null;

export function getPythonBridge(): PythonBridge {
  if (!pythonBridgeInstance) {
    pythonBridgeInstance = new PythonBridge();
  }
  return pythonBridgeInstance;
}










