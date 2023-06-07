#include "utils.h"

#include <fstream>
#include <sstream>
#include <codecvt>

// https://stackoverflow.com/questions/2573834/c-convert-string-or-char-to-wstring-or-wchar-t
std::wstring utf8_to_wstring(const std::string& str) {
    std::wstring_convert<std::codecvt_utf8<wchar_t>> myconv;
    return myconv.from_bytes(str);
}

std::string wstring_to_utf8(const std::wstring& str) {
    std::wstring_convert<std::codecvt_utf8<wchar_t>> myconv;
    return myconv.to_bytes(str);
}

std::string dirname(const std::string& fname) {
     size_t pos = fname.find_last_of("\\/");
     return std::string::npos == pos ? "" : fname.substr(0, pos);
}

std::string readFile(const std::string& fname) {
    std::ifstream stream(fname);
    std::stringstream content;
    content << stream.rdbuf();
    return content.str();
}

void writeFile(const std::string& fname, const std::string& content) {
    std::ofstream stream(fname);
    stream << content;
    stream.close();
}
