#include <string>

std::wstring utf8_to_wstring(const std::string& str);
std::string wstring_to_utf8(const std::wstring& str);
std::string dirname(const std::string& fname);
std::string readFile(const std::string& fname);
void writeFile(const std::string& fname, const std::string& content);
