
import win32serviceutil
import win32service
import win32event
import servicemanager
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import ProtektAgent

class ProtektAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "ProtektAgent"
    _svc_display_name_ = "Protekt Agent"
    _svc_description_ = "Protekt Agent - SME Device Monitoring Service"
    
    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.agent = None
    
    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        if self.agent:
            self.agent.stop()
    
    def SvcDoRun(self):
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE,
                            servicemanager.PYS_SERVICE_STARTED,
                            (self._svc_name_, ''))
        self.main()
    
    def main(self):
        try:
            self.agent = ProtektAgent()
            self.agent.start()
        except Exception as e:
            servicemanager.LogErrorMsg(f"Protekt Agent error: {e}")

if __name__ == '__main__':
    win32serviceutil.HandleCommandLine(ProtektAgentService)
